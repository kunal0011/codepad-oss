package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/codepad/execution-engine/internal/container"
	"github.com/codepad/execution-engine/internal/executor"
	"github.com/codepad/execution-engine/internal/governor"
	"github.com/codepad/execution-engine/internal/runtime"
	"github.com/codepad/execution-engine/pkg/config"
	"github.com/codepad/execution-engine/pkg/types"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// Setup logging
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	if os.Getenv("NODE_ENV") == "development" || os.Getenv("GIN_MODE") != "release" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}

	cfg := config.Load()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// ─── Initialize Components ──────────────────────────────

	// 1. Resource Governor (CE-004)
	gov := governor.New()
	gov.SetQuotaForPlan("default", "team")
	gov.StartAlertConsumer(ctx)
	log.Info().Msg("Resource governor initialized")

	// 3. Runtime Registry (CE-002)
	registry, err := runtime.NewRegistry()
	if err != nil {
		log.Warn().Err(err).Msg("Runtime registry initialization failed")
	} else {
		// Pull images in background
		go func() {
			if err := registry.Init(ctx); err != nil {
				log.Warn().Err(err).Msg("Some runtime images failed to pull")
			}
		}()
		log.Info().Msg("Runtime registry initialized")
	}

	// 4. Container Pool (CE-001)
	pool, err := container.NewPool(cfg)
	if err != nil {
		log.Warn().Err(err).Msg("Container pool initialization failed (Docker may not be available)")
	} else if pool != nil {
		pool.Start(ctx)
		log.Info().Msg("Container pool started")
	}

	// 5. Executor (CE-001, CE-005)
	exec, err := executor.New(cfg, gov, pool)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize executor")
	}
	defer exec.Close()
	log.Info().Msg("Executor initialized")

	// ─── HTTP Server ────────────────────────────────────────
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(requestLogger())

	// Health & readiness
	r.GET("/health", func(c *gin.Context) {
		metrics := map[string]interface{}{
			"status":  "ok",
			"service": "codepad-execution-engine",
			"time":    time.Now().UTC(),
			"uptime":  time.Since(startTime).String(),
		}
		if pool != nil {
			metrics["containers"] = map[string]interface{}{
				"active": pool.ActiveCount(),
				"warm":   pool.WarmCount(),
			}
		}
		c.JSON(http.StatusOK, metrics)
	})

	r.GET("/ready", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})

	// ─── API v1 Routes ──────────────────────────────────────

	v1 := r.Group("/api/v1")
	{
		// CE-001 + CE-003 + CE-005: Execute code
		v1.POST("/execute", func(c *gin.Context) {
			var req types.ExecutionRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "Invalid request: " + err.Error(),
				})
				return
			}

			log.Info().
				Str("executionId", req.ExecutionID).
				Str("language", string(req.Language)).
				Int("fileCount", len(req.Files)).
				Int("timeout", req.Timeout).
				Msg("Execution request received")

			execCtx, execCancel := context.WithTimeout(
				c.Request.Context(),
				time.Duration(req.Timeout+5)*time.Second,
			)
			defer execCancel()

			result, err := exec.Execute(execCtx, req)
			if err != nil {
				log.Error().Err(err).Str("executionId", req.ExecutionID).Msg("Execution failed")
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, result)
		})

		// CE-002: List supported runtimes
		v1.GET("/runtimes", func(c *gin.Context) {
			if registry != nil {
				runtimeInfos := registry.List()
				c.JSON(http.StatusOK, gin.H{
					"runtimes": runtimeInfos,
					"count":    len(runtimeInfos),
				})
			} else {
				// Fallback to static list
				runtimes := make([]types.RuntimeConfig, 0, len(types.Runtimes))
				for _, rt := range types.Runtimes {
					runtimes = append(runtimes, rt)
				}
				c.JSON(http.StatusOK, gin.H{
					"runtimes": runtimes,
					"count":    len(runtimes),
				})
			}
		})

		// CE-002: Add/update runtime (admin)
		v1.POST("/runtimes", func(c *gin.Context) {
			if registry == nil {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Registry not available"})
				return
			}

			var cfg types.RuntimeConfig
			if err := c.ShouldBindJSON(&cfg); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			if err := registry.AddRuntime(c.Request.Context(), cfg); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"status": "ok", "language": cfg.Language})
		})

		// CE-002: Remove runtime (admin)
		v1.DELETE("/runtimes/:language", func(c *gin.Context) {
			if registry == nil {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Registry not available"})
				return
			}

			lang := types.Language(c.Param("language"))
			registry.RemoveRuntime(lang)
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})

		// CE-002: Scan images for vulnerabilities
		v1.POST("/runtimes/scan", func(c *gin.Context) {
			if registry == nil {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Registry not available"})
				return
			}

			results := registry.ScanVulnerabilities(c.Request.Context())
			c.JSON(http.StatusOK, gin.H{"results": results})
		})

		// CE-004: Quota usage & metrics
		v1.GET("/quotas/usage", func(c *gin.Context) {
			usage := gov.GetAllUsage()
			metrics := gov.ExportMetrics()
			c.JSON(http.StatusOK, gin.H{
				"usage":   usage,
				"metrics": metrics,
			})
		})

		// CE-004: Set quota for a key
		v1.PUT("/quotas/:key", func(c *gin.Context) {
			var cfg governor.QuotaConfig
			if err := c.ShouldBindJSON(&cfg); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			gov.SetQuota(c.Param("key"), cfg)
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})

		// Container pool metrics
		v1.GET("/pool/metrics", func(c *gin.Context) {
			if pool == nil {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Pool not available"})
				return
			}

			m := pool.GetMetrics()
			c.JSON(http.StatusOK, gin.H{
				"active":          m.ActiveContainers,
				"warm":            m.WarmContainers,
				"totalCreated":    m.TotalCreated,
				"totalDestroyed":  m.TotalDestroyed,
				"totalReused":     m.TotalReused,
				"avgProvisionMs":  m.AvgProvisionMs,
			})
		})
	}

	// ─── Start Server ───────────────────────────────────────
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 90 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Info().Int("port", cfg.Port).Msg("Execution engine started")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed")
		}
	}()

	// ─── Graceful Shutdown ──────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down execution engine...")
	cancel() // Cancel context for background goroutines

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatal().Err(err).Msg("Server forced to shutdown")
	}

	// Cleanup
	if pool != nil {
		pool.Shutdown(shutdownCtx)
	}
	if registry != nil {
		registry.Close()
	}

	log.Info().Msg("Execution engine stopped")
}

var startTime = time.Now()

func requestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start)

		if c.Request.URL.Path != "/health" && c.Request.URL.Path != "/ready" {
			log.Info().
				Str("method", c.Request.Method).
				Str("path", c.Request.URL.Path).
				Int("status", c.Writer.Status()).
				Dur("duration", duration).
				Msg("Request")
		}
	}
}
