package governor

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

// QuotaLevel defines the scope of a quota
type QuotaLevel string

const (
	UserLevel QuotaLevel = "user"
	TeamLevel QuotaLevel = "team"
	OrgLevel  QuotaLevel = "org"
)

// QuotaConfig defines resource limits for a given scope
type QuotaConfig struct {
	MaxConcurrentSessions int           `json:"maxConcurrentSessions"`
	MaxExecutionTimeSec   int           `json:"maxExecutionTimeSec"`
	MaxExecutionsPerHour  int           `json:"maxExecutionsPerHour"`
	MaxMemoryMB           int64         `json:"maxMemoryMB"`
	SoftLimitPercent      float64       `json:"softLimitPercent"` // Alert at this threshold (e.g. 0.8 = 80%)
}

// DefaultQuotas for different plan tiers
var DefaultQuotas = map[string]QuotaConfig{
	"free": {
		MaxConcurrentSessions: 1,
		MaxExecutionTimeSec:   10,
		MaxExecutionsPerHour:  30,
		MaxMemoryMB:           256,
		SoftLimitPercent:      0.8,
	},
	"team": {
		MaxConcurrentSessions: 5,
		MaxExecutionTimeSec:   30,
		MaxExecutionsPerHour:  200,
		MaxMemoryMB:           512,
		SoftLimitPercent:      0.8,
	},
	"enterprise": {
		MaxConcurrentSessions: 20,
		MaxExecutionTimeSec:   60,
		MaxExecutionsPerHour:  1000,
		MaxMemoryMB:           1024,
		SoftLimitPercent:      0.8,
	},
}

// UsageRecord tracks resource consumption
type UsageRecord struct {
	ActiveSessions    int       `json:"activeSessions"`
	ExecutionsThisHour int      `json:"executionsThisHour"`
	TotalExecutionMs  int64     `json:"totalExecutionMs"`
	TotalMemoryBytes  int64     `json:"totalMemoryBytes"`
	LastExecution     time.Time `json:"lastExecution"`
	HourWindowStart   time.Time `json:"hourWindowStart"`
}

// QuotaCheckResult is the result of a quota check
type QuotaCheckResult struct {
	Allowed      bool    `json:"allowed"`
	Reason       string  `json:"reason,omitempty"`
	SoftWarning  bool    `json:"softWarning"`
	WarningMsg   string  `json:"warningMessage,omitempty"`
	UsagePercent float64 `json:"usagePercent"`
}

// Governor enforces resource quotas and usage limits
type Governor struct {
	mu     sync.RWMutex
	quotas map[string]QuotaConfig          // quotaKey -> config
	usage  map[string]*UsageRecord         // quotaKey -> current usage
	alerts chan Alert
}

// Alert is emitted when a soft limit is hit
type Alert struct {
	Level     QuotaLevel `json:"level"`
	Key       string     `json:"key"`
	Metric    string     `json:"metric"`
	Current   float64    `json:"current"`
	Limit     float64    `json:"limit"`
	Percent   float64    `json:"percent"`
	Timestamp time.Time  `json:"timestamp"`
}

func New() *Governor {
	return &Governor{
		quotas: make(map[string]QuotaConfig),
		usage:  make(map[string]*UsageRecord),
		alerts: make(chan Alert, 100),
	}
}

// SetQuota configures a quota for a given scope key
func (g *Governor) SetQuota(key string, config QuotaConfig) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.quotas[key] = config
}

// SetQuotaForPlan sets quota from a plan name
func (g *Governor) SetQuotaForPlan(key string, plan string) {
	quota, ok := DefaultQuotas[plan]
	if !ok {
		quota = DefaultQuotas["free"]
	}
	g.SetQuota(key, quota)
}

// CheckExecution validates whether an execution is allowed
func (g *Governor) CheckExecution(userKey, teamKey, orgKey string) QuotaCheckResult {
	// Check from most specific to least: user -> team -> org
	keys := []struct {
		key   string
		level QuotaLevel
	}{
		{userKey, UserLevel},
		{teamKey, TeamLevel},
		{orgKey, OrgLevel},
	}

	var finalResult QuotaCheckResult = QuotaCheckResult{Allowed: true}

	for _, k := range keys {
		if k.key == "" {
			continue
		}
		result := g.checkKey(k.key, k.level)
		if !result.Allowed {
			return result
		}
		if result.SoftWarning {
			// Track the warning but continue checking other levels
			if !finalResult.SoftWarning {
				finalResult.SoftWarning = true
				finalResult.WarningMsg = result.WarningMsg
				finalResult.UsagePercent = result.UsagePercent
			}
			// Log but continue
			log.Warn().
				Str("key", k.key).
				Str("level", string(k.level)).
				Str("warning", result.WarningMsg).
				Msg("Soft quota warning")
		}
	}

	return finalResult
}

func (g *Governor) checkKey(key string, level QuotaLevel) QuotaCheckResult {
	g.mu.RLock()
	quota, hasQuota := g.quotas[key]
	usage := g.getOrCreateUsage(key)
	g.mu.RUnlock()

	if !hasQuota {
		return QuotaCheckResult{Allowed: true}
	}

	// Reset hour window if needed
	now := time.Now()
	if now.Sub(usage.HourWindowStart) > time.Hour {
		g.mu.Lock()
		usage.ExecutionsThisHour = 0
		usage.HourWindowStart = now
		g.mu.Unlock()
	}

	// Check concurrent sessions
	if usage.ActiveSessions >= quota.MaxConcurrentSessions {
		return QuotaCheckResult{
			Allowed:      false,
			Reason:       fmt.Sprintf("Maximum concurrent sessions reached (%d/%d)", usage.ActiveSessions, quota.MaxConcurrentSessions),
			UsagePercent: 1.0,
		}
	}

	// Check hourly executions
	if usage.ExecutionsThisHour >= quota.MaxExecutionsPerHour {
		return QuotaCheckResult{
			Allowed:      false,
			Reason:       fmt.Sprintf("Hourly execution limit reached (%d/%d)", usage.ExecutionsThisHour, quota.MaxExecutionsPerHour),
			UsagePercent: 1.0,
		}
	}

	// Check soft limits
	execPercent := float64(usage.ExecutionsThisHour) / float64(quota.MaxExecutionsPerHour)
	if execPercent >= quota.SoftLimitPercent {
		g.emitAlert(Alert{
			Level:     level,
			Key:       key,
			Metric:    "executions_per_hour",
			Current:   float64(usage.ExecutionsThisHour),
			Limit:     float64(quota.MaxExecutionsPerHour),
			Percent:   execPercent,
			Timestamp: now,
		})
		return QuotaCheckResult{
			Allowed:      true,
			SoftWarning:  true,
			WarningMsg:   fmt.Sprintf("Approaching execution limit: %d/%d (%.0f%%)", usage.ExecutionsThisHour, quota.MaxExecutionsPerHour, execPercent*100),
			UsagePercent: execPercent,
		}
	}

	return QuotaCheckResult{Allowed: true, UsagePercent: execPercent}
}

// RecordExecution records an execution for quota tracking
func (g *Governor) RecordExecution(key string, durationMs int64, memoryBytes int64) {
	g.mu.Lock()
	defer g.mu.Unlock()

	usage := g.getOrCreateUsage(key)
	usage.ExecutionsThisHour++
	usage.TotalExecutionMs += durationMs
	usage.TotalMemoryBytes += memoryBytes
	usage.LastExecution = time.Now()
}

// IncrementSessions increments active session count
func (g *Governor) IncrementSessions(key string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	usage := g.getOrCreateUsage(key)
	usage.ActiveSessions++
}

// DecrementSessions decrements active session count
func (g *Governor) DecrementSessions(key string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	usage := g.getOrCreateUsage(key)
	if usage.ActiveSessions > 0 {
		usage.ActiveSessions--
	}
}

// GetUsage returns current usage for a key
func (g *Governor) GetUsage(key string) *UsageRecord {
	g.mu.RLock()
	defer g.mu.RUnlock()
	if u, ok := g.usage[key]; ok {
		copy := *u
		return &copy
	}
	return &UsageRecord{}
}

// GetAllUsage returns a snapshot of all usage records
func (g *Governor) GetAllUsage() map[string]UsageRecord {
	g.mu.RLock()
	defer g.mu.RUnlock()

	result := make(map[string]UsageRecord, len(g.usage))
	for k, v := range g.usage {
		result[k] = *v
	}
	return result
}

// Alerts returns the alert channel
func (g *Governor) Alerts() <-chan Alert {
	return g.alerts
}

// ExportMetrics returns Prometheus-compatible metrics
func (g *Governor) ExportMetrics() map[string]interface{} {
	g.mu.RLock()
	defer g.mu.RUnlock()

	totalSessions := 0
	totalExecs := 0
	for _, u := range g.usage {
		totalSessions += u.ActiveSessions
		totalExecs += u.ExecutionsThisHour
	}

	return map[string]interface{}{
		"governor_total_active_sessions":        totalSessions,
		"governor_total_executions_current_hour": totalExecs,
		"governor_tracked_entities":              len(g.usage),
	}
}

func (g *Governor) getOrCreateUsage(key string) *UsageRecord {
	usage, ok := g.usage[key]
	if !ok {
		usage = &UsageRecord{
			HourWindowStart: time.Now(),
		}
		g.usage[key] = usage
	}
	return usage
}

func (g *Governor) emitAlert(alert Alert) {
	select {
	case g.alerts <- alert:
	default:
		log.Warn().Str("key", alert.Key).Msg("Alert channel full, dropping alert")
	}
}

// StartAlertConsumer logs alerts (in production, send to PagerDuty/Prometheus)
func (g *Governor) StartAlertConsumer(ctx context.Context) {
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case alert := <-g.alerts:
				log.Warn().
					Str("level", string(alert.Level)).
					Str("key", alert.Key).
					Str("metric", alert.Metric).
					Float64("current", alert.Current).
					Float64("limit", alert.Limit).
					Float64("percent", alert.Percent*100).
					Msg("Quota soft limit reached")
			}
		}
	}()
}
