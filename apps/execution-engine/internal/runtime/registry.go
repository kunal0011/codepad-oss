package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"sync"
	"time"

	"github.com/codepad/execution-engine/pkg/types"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"
	"github.com/rs/zerolog/log"
)

// RuntimeInfo describes a cached runtime with metadata
type RuntimeInfo struct {
	types.RuntimeConfig
	ImageID    string    `json:"imageId"`
	ImageSize  int64     `json:"imageSizeBytes"`
	Cached     bool      `json:"cached"`
	PulledAt   time.Time `json:"pulledAt"`
	LastUsed   time.Time `json:"lastUsed"`
}

// Registry manages language runtime images
type Registry struct {
	mu       sync.RWMutex
	docker   *client.Client
	runtimes map[types.Language]*RuntimeInfo
}

func NewRegistry() (*Registry, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}

	r := &Registry{
		docker:   cli,
		runtimes: make(map[types.Language]*RuntimeInfo),
	}

	// Initialize from known runtimes
	for lang, cfg := range types.Runtimes {
		r.runtimes[lang] = &RuntimeInfo{
			RuntimeConfig: cfg,
			Cached:        false,
		}
	}

	return r, nil
}

// Init pulls all runtime images and checks cache status
func (r *Registry) Init(ctx context.Context) error {
	log.Info().Int("runtimes", len(r.runtimes)).Msg("Initializing runtime registry")

	var wg sync.WaitGroup
	errCh := make(chan error, len(r.runtimes))

	for lang, info := range r.runtimes {
		wg.Add(1)
		go func(l types.Language, ri *RuntimeInfo) {
			defer wg.Done()
			if err := r.ensureImage(ctx, l, ri); err != nil {
				log.Error().Err(err).Str("language", string(l)).Msg("Failed to pull runtime image")
				errCh <- err
			}
		}(lang, info)
	}

	wg.Wait()
	close(errCh)

	// Log results
	cached := 0
	for _, info := range r.runtimes {
		if info.Cached {
			cached++
		}
	}
	log.Info().
		Int("total", len(r.runtimes)).
		Int("cached", cached).
		Msg("Runtime registry initialized")

	return nil
}

// Get returns runtime info for a language
func (r *Registry) Get(language types.Language) (*RuntimeInfo, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	info, ok := r.runtimes[language]
	if !ok {
		return nil, fmt.Errorf("unsupported language: %s", language)
	}

	info.LastUsed = time.Now()
	return info, nil
}

// List returns all registered runtimes
func (r *Registry) List() []RuntimeInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]RuntimeInfo, 0, len(r.runtimes))
	for _, info := range r.runtimes {
		result = append(result, *info)
	}
	return result
}

// AddRuntime adds or updates a runtime without downtime
func (r *Registry) AddRuntime(ctx context.Context, cfg types.RuntimeConfig) error {
	info := &RuntimeInfo{
		RuntimeConfig: cfg,
		Cached:        false,
	}

	// Pull the image
	if err := r.ensureImage(ctx, cfg.Language, info); err != nil {
		return fmt.Errorf("failed to pull image for %s: %w", cfg.Language, err)
	}

	r.mu.Lock()
	r.runtimes[cfg.Language] = info
	r.mu.Unlock()

	log.Info().
		Str("language", string(cfg.Language)).
		Str("version", cfg.Version).
		Str("image", cfg.Image).
		Msg("Runtime added/updated")

	return nil
}

// RemoveRuntime removes a runtime
func (r *Registry) RemoveRuntime(language types.Language) {
	r.mu.Lock()
	delete(r.runtimes, language)
	r.mu.Unlock()
	log.Info().Str("language", string(language)).Msg("Runtime removed")
}

// CheckImageSizes validates all images are under the size limit
func (r *Registry) CheckImageSizes(maxSizeMB int64) []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var violations []string
	maxSizeBytes := maxSizeMB * 1024 * 1024

	for lang, info := range r.runtimes {
		if info.ImageSize > maxSizeBytes {
			violations = append(violations, fmt.Sprintf(
				"%s: %dMB (limit: %dMB)",
				lang, info.ImageSize/(1024*1024), maxSizeMB,
			))
		}
	}
	return violations
}

func (r *Registry) ensureImage(ctx context.Context, lang types.Language, info *RuntimeInfo) error {
	imageName := info.Image

	// Check if image exists locally
	inspect, _, err := r.docker.ImageInspectWithRaw(ctx, imageName)
	if err == nil {
		// Image exists
		r.mu.Lock()
		info.ImageID = inspect.ID
		info.ImageSize = inspect.Size
		info.Cached = true
		info.PulledAt = time.Now()
		r.mu.Unlock()

		log.Debug().
			Str("language", string(lang)).
			Str("image", imageName).
			Int64("sizeMB", inspect.Size/(1024*1024)).
			Msg("Runtime image found in cache")
		return nil
	}

	// Pull the image
	log.Info().Str("image", imageName).Msg("Pulling runtime image...")

	reader, err := r.docker.ImagePull(ctx, imageName, image.PullOptions{})
	if err != nil {
		return fmt.Errorf("failed to pull %s: %w", imageName, err)
	}
	defer reader.Close()

	// Read pull output to completion
	decoder := json.NewDecoder(reader)
	for {
		var event map[string]interface{}
		if err := decoder.Decode(&event); err != nil {
			if err == io.EOF {
				break
			}
			// Non-fatal: some pull output can't be decoded
			break
		}
	}

	// Re-inspect after pull
	inspect, _, err = r.docker.ImageInspectWithRaw(ctx, imageName)
	if err != nil {
		return fmt.Errorf("failed to inspect %s after pull: %w", imageName, err)
	}

	r.mu.Lock()
	info.ImageID = inspect.ID
	info.ImageSize = inspect.Size
	info.Cached = true
	info.PulledAt = time.Now()
	r.mu.Unlock()

	log.Info().
		Str("language", string(lang)).
		Str("image", imageName).
		Int64("sizeMB", inspect.Size/(1024*1024)).
		Msg("Runtime image pulled and cached")

	return nil
}

// ScanVulnerabilities performs a basic image scan (stub for CVE scanning)
func (r *Registry) ScanVulnerabilities(ctx context.Context) map[types.Language][]string {
	results := make(map[types.Language][]string)
	r.mu.RLock()
	defer r.mu.RUnlock()

	for lang, info := range r.runtimes {
		if !info.Cached {
			results[lang] = []string{"image not cached, cannot scan"}
			continue
		}
		// In production, integrate with Trivy or Grype here
		// For now, log that a scan was requested
		log.Info().
			Str("language", string(lang)).
			Str("imageId", info.ImageID[:12]).
			Msg("Vulnerability scan requested (stub)")
		results[lang] = []string{} // empty = no vulns found
	}

	return results
}

func (r *Registry) Close() error {
	return r.docker.Close()
}
