package governor

import (
	"testing"
)

func TestNewGovernor(t *testing.T) {
	g := New()
	if g == nil {
		t.Fatal("Expected non-nil governor")
	}
}

func TestSetAndCheckQuota(t *testing.T) {
	g := New()
	g.SetQuota("user:alice", QuotaConfig{
		MaxConcurrentSessions: 2,
		MaxExecutionsPerHour:  10,
		MaxMemoryMB:           512,
		SoftLimitPercent:      0.8,
	})

	// Should be allowed
	result := g.CheckExecution("user:alice", "", "")
	if !result.Allowed {
		t.Fatalf("Expected allowed, got denied: %s", result.Reason)
	}
}

func TestQuotaDenied_ConcurrentSessions(t *testing.T) {
	g := New()
	g.SetQuota("user:bob", QuotaConfig{
		MaxConcurrentSessions: 1,
		MaxExecutionsPerHour:  100,
		SoftLimitPercent:      0.8,
	})

	g.IncrementSessions("user:bob")

	result := g.CheckExecution("user:bob", "", "")
	if result.Allowed {
		t.Fatal("Expected denied due to concurrent session limit")
	}
	if result.Reason == "" {
		t.Fatal("Expected a reason for denial")
	}
}

func TestQuotaDenied_HourlyLimit(t *testing.T) {
	g := New()
	g.SetQuota("user:charlie", QuotaConfig{
		MaxConcurrentSessions: 10,
		MaxExecutionsPerHour:  3,
		SoftLimitPercent:      0.8,
	})

	// Simulate 3 executions
	for i := 0; i < 3; i++ {
		g.RecordExecution("user:charlie", 100, 1000)
	}

	result := g.CheckExecution("user:charlie", "", "")
	if result.Allowed {
		t.Fatal("Expected denied due to hourly execution limit")
	}
}

func TestSoftWarning(t *testing.T) {
	g := New()
	g.SetQuota("user:diana", QuotaConfig{
		MaxConcurrentSessions: 10,
		MaxExecutionsPerHour:  10,
		SoftLimitPercent:      0.8,
	})

	// 8 of 10 executions = 80% = should trigger soft warning
	for i := 0; i < 8; i++ {
		g.RecordExecution("user:diana", 50, 500)
	}

	result := g.CheckExecution("user:diana", "", "")
	if !result.Allowed {
		t.Fatal("Expected allowed with soft warning")
	}
	if !result.SoftWarning {
		t.Fatal("Expected soft warning at 80% usage")
	}
}

func TestDefaultPlanQuotas(t *testing.T) {
	for plan, quota := range DefaultQuotas {
		if quota.MaxConcurrentSessions <= 0 {
			t.Errorf("Plan %s has invalid MaxConcurrentSessions: %d", plan, quota.MaxConcurrentSessions)
		}
		if quota.MaxExecutionsPerHour <= 0 {
			t.Errorf("Plan %s has invalid MaxExecutionsPerHour: %d", plan, quota.MaxExecutionsPerHour)
		}
		if quota.SoftLimitPercent <= 0 || quota.SoftLimitPercent > 1 {
			t.Errorf("Plan %s has invalid SoftLimitPercent: %f", plan, quota.SoftLimitPercent)
		}
	}
}

func TestDecrementSessions(t *testing.T) {
	g := New()
	g.IncrementSessions("user:eve")
	g.IncrementSessions("user:eve")

	usage := g.GetUsage("user:eve")
	if usage.ActiveSessions != 2 {
		t.Fatalf("Expected 2 active sessions, got %d", usage.ActiveSessions)
	}

	g.DecrementSessions("user:eve")
	usage = g.GetUsage("user:eve")
	if usage.ActiveSessions != 1 {
		t.Fatalf("Expected 1 active session, got %d", usage.ActiveSessions)
	}

	// Decrement below 0 should not go negative
	g.DecrementSessions("user:eve")
	g.DecrementSessions("user:eve")
	usage = g.GetUsage("user:eve")
	if usage.ActiveSessions != 0 {
		t.Fatalf("Expected 0 active sessions, got %d", usage.ActiveSessions)
	}
}

func TestExportMetrics(t *testing.T) {
	g := New()
	g.IncrementSessions("user:a")
	g.IncrementSessions("user:b")
	g.RecordExecution("user:a", 100, 1000)

	metrics := g.ExportMetrics()

	if metrics["governor_total_active_sessions"].(int) != 2 {
		t.Errorf("Expected 2 active sessions, got %v", metrics["governor_total_active_sessions"])
	}
	if metrics["governor_total_executions_current_hour"].(int) != 1 {
		t.Errorf("Expected 1 execution, got %v", metrics["governor_total_executions_current_hour"])
	}
}

func TestMultiLevelQuotaCheck(t *testing.T) {
	g := New()

	// User is fine
	g.SetQuota("user:frank", QuotaConfig{
		MaxConcurrentSessions: 10,
		MaxExecutionsPerHour:  100,
		SoftLimitPercent:      0.8,
	})

	// But org is maxed out
	g.SetQuota("org:startup", QuotaConfig{
		MaxConcurrentSessions: 1,
		MaxExecutionsPerHour:  5,
		SoftLimitPercent:      0.8,
	})
	g.IncrementSessions("org:startup")

	result := g.CheckExecution("user:frank", "", "org:startup")
	if result.Allowed {
		t.Fatal("Expected denied at org level")
	}
}
