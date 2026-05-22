package container

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"github.com/codepad/execution-engine/pkg/config"
	"github.com/codepad/execution-engine/pkg/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
	"github.com/rs/zerolog/log"
)

// ContainerInfo tracks a managed container
type ContainerInfo struct {
	ID        string
	Language  types.Language
	Status    string
	CreatedAt time.Time
	SessionID string
	LastUsed  time.Time
}

// Pool manages a pool of warm containers for fast provisioning
type Pool struct {
	mu         sync.RWMutex
	docker     *client.Client
	config     *config.Config
	warm       map[types.Language][]*ContainerInfo // pre-warmed containers per language
	active     map[string]*ContainerInfo           // active containers by ID
	metrics    PoolMetrics
	stopCh     chan struct{}
}

// PoolMetrics tracks container pool statistics
type PoolMetrics struct {
	mu                sync.RWMutex
	TotalCreated      int64
	TotalDestroyed    int64
	TotalReused       int64
	ActiveContainers  int
	WarmContainers    int
	AvgProvisionMs    float64
	provisionTimes    []int64
}

func (m *PoolMetrics) recordProvision(ms int64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.provisionTimes = append(m.provisionTimes, ms)
	if len(m.provisionTimes) > 100 {
		m.provisionTimes = m.provisionTimes[len(m.provisionTimes)-100:]
	}
	var total int64
	for _, t := range m.provisionTimes {
		total += t
	}
	m.AvgProvisionMs = float64(total) / float64(len(m.provisionTimes))
}

func NewPool(cfg *config.Config) (*Pool, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}

	p := &Pool{
		docker: cli,
		config: cfg,
		warm:   make(map[types.Language][]*ContainerInfo),
		active: make(map[string]*ContainerInfo),
		stopCh: make(chan struct{}),
	}

	// Initialize cache volumes
	if err := p.initVolumes(context.Background()); err != nil {
		log.Error().Err(err).Msg("Failed to initialize compiler cache volumes")
	}

	return p, nil
}

// Start begins background maintenance goroutines
func (p *Pool) Start(ctx context.Context) {
	// Periodic pre-warming of containers
	go p.warmContainersLoop(ctx)

	// Periodic cleanup of idle/expired containers
	go p.cleanupLoop(ctx)

	// Periodic metric reporting
	go p.metricsLoop(ctx)

	log.Info().Int("poolSize", p.config.PoolSize).Msg("Container pool started")
}

// Acquire gets a container for the given language, preferring warm containers
func (p *Pool) Acquire(ctx context.Context, language types.Language, sessionID string) (*ContainerInfo, error) {
	start := time.Now()

	// Try to get a warm container first
	info := p.getWarm(language)
	if info != nil {
		info.SessionID = sessionID
		info.LastUsed = time.Now()
		p.mu.Lock()
		p.active[info.ID] = info
		p.metrics.TotalReused++
		p.mu.Unlock()
		p.metrics.recordProvision(time.Since(start).Milliseconds())
		log.Info().
			Str("containerId", info.ID[:12]).
			Str("language", string(language)).
			Int64("provisionMs", time.Since(start).Milliseconds()).
			Msg("Reused warm container")
		return info, nil
	}

	// No warm container available; create a new one
	info, err := p.create(ctx, language, sessionID)
	if err != nil {
		return nil, err
	}

	p.mu.Lock()
	p.active[info.ID] = info
	p.metrics.TotalCreated++
	p.mu.Unlock()

	p.metrics.recordProvision(time.Since(start).Milliseconds())

	log.Info().
		Str("containerId", info.ID[:12]).
		Str("language", string(language)).
		Int64("provisionMs", time.Since(start).Milliseconds()).
		Msg("Created new container")

	return info, nil
}

// Release returns a container to the pool or destroys it
func (p *Pool) Release(ctx context.Context, containerID string, reusable bool) {
	p.mu.Lock()
	info, exists := p.active[containerID]
	if exists {
		delete(p.active, containerID)
	}
	p.mu.Unlock()

	if !exists {
		return
	}

	if reusable {
		// Return to warm pool if we have capacity
		p.mu.Lock()
		warmCount := 0
		for _, containers := range p.warm {
			warmCount += len(containers)
		}
		if warmCount < p.config.PoolSize {
			info.Status = "warm"
			info.SessionID = ""
			info.LastUsed = time.Now()
			p.warm[types.Language(info.Language)] = append(p.warm[types.Language(info.Language)], info)
			p.mu.Unlock()
			log.Debug().Str("containerId", containerID[:12]).Msg("Container returned to warm pool")
			return
		}
		p.mu.Unlock()
	}

	// Destroy the container
	p.destroy(ctx, containerID)
}

// ActiveCount returns the number of active containers
func (p *Pool) ActiveCount() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return len(p.active)
}

// WarmCount returns the number of warm containers
func (p *Pool) WarmCount() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	count := 0
	for _, containers := range p.warm {
		count += len(containers)
	}
	return count
}

// GetMetrics returns current pool metrics
func (p *Pool) GetMetrics() PoolMetrics {
	p.mu.RLock()
	defer p.mu.RUnlock()
	m := p.metrics
	m.ActiveContainers = len(p.active)
	warmCount := 0
	for _, containers := range p.warm {
		warmCount += len(containers)
	}
	m.WarmContainers = warmCount
	return m
}

func (p *Pool) getWarm(language types.Language) *ContainerInfo {
	p.mu.Lock()
	defer p.mu.Unlock()

	containers := p.warm[language]
	if len(containers) == 0 {
		return nil
	}

	// Pop last container
	info := containers[len(containers)-1]
	p.warm[language] = containers[:len(containers)-1]
	info.Status = "active"
	return info
}

func (p *Pool) create(ctx context.Context, language types.Language, sessionID string) (*ContainerInfo, error) {
	runtime, ok := types.Runtimes[language]
	if !ok {
		return nil, fmt.Errorf("unsupported language: %s", language)
	}

	memoryBytes := p.config.MaxContainerMemMB * 1024 * 1024
	nanoCPUs := p.config.MaxContainerCPU * 1e9

	containerConfig := &container.Config{
		Image:           runtime.Image,
		Cmd:             []string{"sleep", "infinity"}, // Keep alive for reuse
		WorkingDir:      "/workspace",
		NetworkDisabled: true,
		Labels: map[string]string{
			"codepad.managed": "true",
			"codepad.language": string(language),
			"codepad.session":  sessionID,
		},
	}

	var binds []string
	if language == types.Rust {
		binds = append(binds, "codepad-rust-cache:/usr/local/cargo/registry")
		binds = append(binds, "codepad-rust-target-cache:/workspace/target")
	} else if language == types.Cpp {
		binds = append(binds, "codepad-cpp-cache:/workspace/.cache")
	}

	hostConfig := &container.HostConfig{
		Resources: container.Resources{
			Memory:     memoryBytes,
			NanoCPUs:   nanoCPUs,
			MemorySwap: memoryBytes, // No swap
			PidsLimit:  int64Ptr(64),
		},
		ReadonlyRootfs: true,
		SecurityOpt:    []string{"no-new-privileges"},
		CapDrop:        []string{"ALL"},
		Tmpfs: map[string]string{
			"/tmp":       "rw,noexec,nosuid,size=64m",
			"/workspace": "rw,size=64m",
		},
		Binds: binds,
	}

	var name string
	if sessionID == "warm-pool" {
		name = fmt.Sprintf("codepad-warm-%s-%s", language, generateRandomID(8))
	} else {
		name = fmt.Sprintf("codepad-exec-%s-%s", language, generateRandomID(8))
	}

	resp, err := p.docker.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, name)
	if err != nil {
		return nil, fmt.Errorf("failed to create container: %w", err)
	}

	if err := p.docker.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		// Clean up on failure
		_ = p.docker.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		return nil, fmt.Errorf("failed to start container: %w", err)
	}

	return &ContainerInfo{
		ID:        resp.ID,
		Language:  language,
		Status:    "active",
		CreatedAt: time.Now(),
		SessionID: sessionID,
		LastUsed:  time.Now(),
	}, nil
}

func (p *Pool) destroy(ctx context.Context, containerID string) {
	timeout := 5
	_ = p.docker.ContainerStop(ctx, containerID, container.StopOptions{Timeout: &timeout})
	_ = p.docker.ContainerRemove(ctx, containerID, container.RemoveOptions{Force: true})

	p.mu.Lock()
	p.metrics.TotalDestroyed++
	p.mu.Unlock()

	log.Debug().Str("containerId", containerID[:12]).Msg("Container destroyed")
}

func (p *Pool) warmContainersLoop(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	// Initial warm
	p.warmContainers(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-p.stopCh:
			return
		case <-ticker.C:
			p.warmContainers(ctx)
		}
	}
}

func (p *Pool) warmContainers(ctx context.Context) {
	// Pre-warm containers for the most popular languages
	popularLanguages := []types.Language{types.Python, types.JavaScript, types.Go}

	for _, lang := range popularLanguages {
		p.mu.RLock()
		currentWarm := len(p.warm[lang])
		p.mu.RUnlock()

		target := 2
		if p.config.PoolSize < 6 {
			target = 1
		}

		for currentWarm < target {
			info, err := p.create(ctx, lang, "warm-pool")
			if err != nil {
				// If it fails (likely image pulling in progress), stop for this language and try next later
				log.Debug().Err(err).Str("language", string(lang)).Msg("Could not pre-warm container (yet)")
				break
			}
			info.Status = "warm"
			info.SessionID = ""

			p.mu.Lock()
			p.warm[lang] = append(p.warm[lang], info)
			p.mu.Unlock()

			currentWarm++
			log.Info().Str("language", string(lang)).Msg("Pre-warmed container")
		}
	}
}

func (p *Pool) cleanupLoop(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-p.stopCh:
			return
		case <-ticker.C:
			p.cleanup(ctx)
		}
	}
}

func (p *Pool) cleanup(ctx context.Context) {
	now := time.Now()
	idleTimeout := time.Duration(p.config.IdleTimeoutSec) * time.Second
	maxLifetime := time.Duration(p.config.MaxLifetimeSec) * time.Second

	// Clean up active containers that exceeded lifetime
	p.mu.Lock()
	var toDestroy []string
	for id, info := range p.active {
		if now.Sub(info.CreatedAt) > maxLifetime {
			toDestroy = append(toDestroy, id)
			delete(p.active, id)
			log.Warn().Str("containerId", id[:12]).Msg("Container exceeded max lifetime, destroying")
		} else if now.Sub(info.LastUsed) > idleTimeout {
			toDestroy = append(toDestroy, id)
			delete(p.active, id)
			log.Info().Str("containerId", id[:12]).Msg("Container idle timeout, destroying")
		}
	}

	// Clean up stale warm containers (older than 10 minutes)
	warmMaxAge := 10 * time.Minute
	for lang, containers := range p.warm {
		var kept []*ContainerInfo
		for _, info := range containers {
			if now.Sub(info.CreatedAt) > warmMaxAge {
				toDestroy = append(toDestroy, info.ID)
			} else {
				kept = append(kept, info)
			}
		}
		p.warm[lang] = kept
	}
	p.mu.Unlock()

	// Destroy outside of lock
	for _, id := range toDestroy {
		p.destroy(ctx, id)
	}

	// Also clean up any orphaned codepad containers
	p.cleanupOrphans(ctx)
}

func (p *Pool) cleanupOrphans(ctx context.Context) {
	listFilters := filters.NewArgs()
	listFilters.Add("label", "codepad.managed=true")

	containers, err := p.docker.ContainerList(ctx, container.ListOptions{
		All:     true,
		Filters: listFilters,
	})
	if err != nil {
		return
	}

	p.mu.RLock()
	knownIDs := make(map[string]bool)
	for id := range p.active {
		knownIDs[id] = true
	}
	for _, warmList := range p.warm {
		for _, info := range warmList {
			knownIDs[info.ID] = true
		}
	}
	p.mu.RUnlock()

	for _, c := range containers {
		if !knownIDs[c.ID] {
			// Orphaned container - remove it
			log.Warn().Str("containerId", c.ID[:12]).Msg("Removing orphaned container")
			p.destroy(ctx, c.ID)
		}
	}
}

func (p *Pool) metricsLoop(ctx context.Context) {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-p.stopCh:
			return
		case <-ticker.C:
			m := p.GetMetrics()
			log.Info().
				Int("active", m.ActiveContainers).
				Int("warm", m.WarmContainers).
				Int64("totalCreated", m.TotalCreated).
				Int64("totalDestroyed", m.TotalDestroyed).
				Float64("avgProvisionMs", m.AvgProvisionMs).
				Msg("Container pool metrics")
		}
	}
}

// Shutdown destroys all containers and stops background goroutines
func (p *Pool) Shutdown(ctx context.Context) {
	close(p.stopCh)

	p.mu.Lock()
	var allIDs []string
	for id := range p.active {
		allIDs = append(allIDs, id)
	}
	for _, containers := range p.warm {
		for _, info := range containers {
			allIDs = append(allIDs, info.ID)
		}
	}
	p.active = make(map[string]*ContainerInfo)
	p.warm = make(map[types.Language][]*ContainerInfo)
	p.mu.Unlock()

	for _, id := range allIDs {
		p.destroy(ctx, id)
	}

	p.docker.Close()
	log.Info().Int("destroyed", len(allIDs)).Msg("Container pool shutdown complete")
}

func int64Ptr(v int64) *int64 {
	return &v
}

func generateRandomID(length int) string {
	b := make([]byte, length/2)
	if _, err := rand.Read(b); err != nil {
		return "unknown"
	}
	return hex.EncodeToString(b)
}

func (p *Pool) initVolumes(ctx context.Context) error {
	volumesToCreate := []string{"codepad-rust-cache", "codepad-rust-target-cache", "codepad-cpp-cache"}
	for _, name := range volumesToCreate {
		_, err := p.docker.VolumeCreate(ctx, volume.CreateOptions{
			Name: name,
			Labels: map[string]string{
				"codepad.managed": "true",
			},
		})
		if err != nil {
			log.Warn().Err(err).Str("volume", name).Msg("Could not create cache volume")
		} else {
			log.Info().Str("volume", name).Msg("Ensured cache volume exists")
		}
	}
	return nil
}
