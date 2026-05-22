package executor

import (
	"archive/tar"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/codepad/execution-engine/internal/container"
	"github.com/codepad/execution-engine/internal/governor"
	"github.com/codepad/execution-engine/internal/streaming"
	"github.com/codepad/execution-engine/pkg/config"
	"github.com/codepad/execution-engine/pkg/types"
	dockercontainer "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/rs/zerolog/log"
)

// Executor handles sandboxed code execution
type Executor struct {
	docker   *client.Client
	config   *config.Config
	governor *governor.Governor
	pool     *container.Pool
}

func New(cfg *config.Config, gov *governor.Governor, p *container.Pool) (*Executor, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}

	return &Executor{
		docker:   cli,
		config:   cfg,
		governor: gov,
		pool:     p,
	}, nil
}

// Execute runs code in a sandboxed container
func (e *Executor) Execute(ctx context.Context, req types.ExecutionRequest, callback streaming.StreamCallback) (*types.ExecutionResult, error) {
	runtime, ok := types.Runtimes[req.Language]
	if !ok {
		return nil, fmt.Errorf("unsupported language: %s", req.Language)
	}

	// Validate files
	if err := e.validateFiles(req.Files); err != nil {
		return nil, err
	}

	// Check quotas
	if e.governor != nil {
		check := e.governor.CheckExecution(req.ExecutionID, "", "")
		if !check.Allowed {
			return &types.ExecutionResult{
				Stderr:   fmt.Sprintf("Execution denied: %s", check.Reason),
				ExitCode: -1,
			}, nil
		}
	}

	// Acquire container from pool (CE-001)
	var containerID string
	var usePool bool = e.pool != nil

	if usePool {
		info, err := e.pool.Acquire(ctx, req.Language, req.ExecutionID)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to acquire container from pool, falling back to new container")
			usePool = false
		} else {
			containerID = info.ID
		}
	}

	if !usePool {
		// Fallback: Create a temporary container
		memoryBytes := e.config.MaxContainerMemMB * 1024 * 1024
		if req.MemoryLimit > 0 {
			memoryBytes = int64(req.MemoryLimit) * 1024 * 1024
		}
		nanoCPUs := e.config.MaxContainerCPU * 1e9
		if req.CPULimit > 0 {
			nanoCPUs = int64(req.CPULimit) * 1e9
		}

		containerConfig := &dockercontainer.Config{
			Image:           runtime.Image,
			Cmd:             []string{"sleep", "infinity"},
			WorkingDir:      "/workspace",
			NetworkDisabled: true,
			Labels: map[string]string{
				"codepad.managed":   "true",
				"codepad.execution": req.ExecutionID,
				"codepad.language":  string(req.Language),
			},
		}

		var binds []string
		if req.Language == types.Rust {
			binds = append(binds, "codepad-rust-cache:/usr/local/cargo/registry")
			binds = append(binds, "codepad-rust-target-cache:/workspace/target")
		} else if req.Language == types.Cpp {
			binds = append(binds, "codepad-cpp-cache:/workspace/.cache")
		}

		hostConfig := &dockercontainer.HostConfig{
			Resources: dockercontainer.Resources{
				Memory:     memoryBytes,
				NanoCPUs:   nanoCPUs,
				MemorySwap: memoryBytes,
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

		resp, err := e.docker.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, fmt.Sprintf("codepad-exec-%s-%s", req.Language, generateRandomID(8)))
		if err != nil {
			return nil, fmt.Errorf("failed to create fallback container: %w", err)
		}
		containerID = resp.ID
		if err := e.docker.ContainerStart(ctx, containerID, dockercontainer.StartOptions{}); err != nil {
			_ = e.docker.ContainerRemove(ctx, containerID, dockercontainer.RemoveOptions{Force: true})
			return nil, fmt.Errorf("failed to start fallback container: %w", err)
		}
	}

	// Clean up if not using pool
	defer func() {
		if !usePool {
			cleanupCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			_ = e.docker.ContainerRemove(cleanupCtx, containerID, dockercontainer.RemoveOptions{Force: true})
		} else {
			// Release back to pool
			e.pool.Release(context.Background(), containerID, true)
		}
	}()

	// Upload files (CE-005)
	if err := e.uploadFiles(ctx, containerID, req.Files); err != nil {
		return nil, fmt.Errorf("failed to upload files: %w", err)
	}

	// Build execution command
	cmd := e.buildCommand(runtime, req.Files)

	// Create exec (CE-003)
	execConfig := dockercontainer.ExecOptions{
		Cmd:          []string{"sh", "-c", cmd},
		AttachStdout: true,
		AttachStderr: true,
		AttachStdin:  req.Stdin != "",
		WorkingDir:   "/workspace",
		Env:          []string{"HOME=/workspace", "LANG=C.UTF-8"},
	}

	execIDResp, err := e.docker.ContainerExecCreate(ctx, containerID, execConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create exec: %w", err)
	}

	// Start execution and attach
	startTime := time.Now()
	resp, err := e.docker.ContainerExecAttach(ctx, execIDResp.ID, dockercontainer.ExecAttachOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to attach to exec: %w", err)
	}
	defer resp.Close()

	// Setup streaming (CE-003)
	// For now, we collect output into buffers, but we use the streamer for consistency
	streamer := streaming.NewStreamer(streaming.DefaultConfig(), callback)
	
	outputDone := make(chan error, 1)
	go func() {
		outputDone <- streamer.ProcessDockerStream(ctx, resp.Reader)
	}()

	// Handle stdin
	if req.Stdin != "" {
		_, _ = io.WriteString(resp.Conn, req.Stdin)
	}

	// Wait for completion or timeout
	timeoutDuration := time.Duration(req.Timeout) * time.Second
	timer := time.NewTimer(timeoutDuration)
	defer timer.Stop()

	var exitCode int = -1
	select {
	case <-timer.C:
		// Timeout - nothing to do here, the exec session will be killed when we close the conn or container
		return &types.ExecutionResult{
			Stderr:          "Execution timed out after " + timeoutDuration.String(),
			ExitCode:        -1,
			ExecutionTimeMs: time.Since(startTime).Milliseconds(),
		}, nil
	case err := <-outputDone:
		if err != nil && err != io.EOF {
			log.Error().Err(err).Msg("Error reading execution output")
		}
		
		// Get exit code
		inspect, err := e.docker.ContainerExecInspect(ctx, execIDResp.ID)
		if err == nil {
			exitCode = inspect.ExitCode
		}
	}

	executionTime := time.Since(startTime)

	// Record quota usage
	if e.governor != nil {
		e.governor.RecordExecution(req.ExecutionID, executionTime.Milliseconds(), 0)
	}

	log.Info().
		Str("executionId", req.ExecutionID).
		Str("language", string(req.Language)).
		Int("exitCode", exitCode).
		Int64("durationMs", executionTime.Milliseconds()).
		Msg("Execution completed")

	return &types.ExecutionResult{
		Stdout:          streamer.GetStdout(),
		Stderr:          streamer.GetStderr(),
		ExitCode:        exitCode,
		ExecutionTimeMs: executionTime.Milliseconds(),
	}, nil
}

// uploadFiles packs files into a tar stream and uploads to the container
func (e *Executor) uploadFiles(ctx context.Context, containerID string, files []types.FileEntry) error {
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)

	for _, f := range files {
		hdr := &tar.Header{
			Name: f.Path,
			Mode: 0644,
			Size: int64(len(f.Content)),
		}
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		if _, err := tw.Write([]byte(f.Content)); err != nil {
			return err
		}
	}

	if err := tw.Close(); err != nil {
		return err
	}

	// Clean existing files (CE-001)
	cleanConfig := dockercontainer.ExecOptions{
		Cmd: []string{"sh", "-c", "rm -rf /workspace/*"},
	}
	cleanID, err := e.docker.ContainerExecCreate(ctx, containerID, cleanConfig)
	if err == nil {
		_ = e.docker.ContainerExecStart(ctx, cleanID.ID, dockercontainer.ExecStartOptions{})
	}

	return e.docker.CopyToContainer(ctx, containerID, "/workspace", &buf, dockercontainer.CopyToContainerOptions{})
}

// validateFiles checks file constraints
func (e *Executor) validateFiles(files []types.FileEntry) error {
	if len(files) == 0 {
		return fmt.Errorf("at least one file is required")
	}
	if len(files) > 50 {
		return fmt.Errorf("maximum 50 files allowed, got %d", len(files))
	}

	var totalSize int
	for _, f := range files {
		totalSize += len(f.Content)

		// Validate path (prevent path traversal)
		clean := filepath.Clean(f.Path)
		if strings.HasPrefix(clean, "..") || strings.HasPrefix(clean, "/") {
			return fmt.Errorf("invalid file path: %s", f.Path)
		}
	}

	maxSize := 10 * 1024 * 1024 // 10MB
	if totalSize > maxSize {
		return fmt.Errorf("total file size %dMB exceeds limit of %dMB",
			totalSize/(1024*1024), maxSize/(1024*1024))
	}

	return nil
}

// writeFiles writes user files to the workspace directory
func (e *Executor) writeFiles(workDir string, files []types.FileEntry, language types.Language) error {
	for _, f := range files {
		filePath := filepath.Join(workDir, filepath.Clean(f.Path))
		dir := filepath.Dir(filePath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
		if err := os.WriteFile(filePath, []byte(f.Content), 0644); err != nil {
			return fmt.Errorf("failed to write file %s: %w", f.Path, err)
		}
	}

	// For Java: ensure package structure
	if language == types.Java {
		// Scan for package declarations and adjust classpath
		for _, f := range files {
			if strings.HasSuffix(f.Path, ".java") {
				for _, line := range strings.Split(f.Content, "\n") {
					line = strings.TrimSpace(line)
					if strings.HasPrefix(line, "package ") {
						pkg := strings.TrimPrefix(line, "package ")
						pkg = strings.TrimSuffix(pkg, ";")
						pkg = strings.TrimSpace(pkg)
						// Ensure directory matches package
						pkgDir := filepath.Join(workDir, strings.ReplaceAll(pkg, ".", "/"))
						os.MkdirAll(pkgDir, 0755)
						break
					}
				}
			}
		}
	}

	return nil
}

// buildCommand constructs the shell command for execution
func (e *Executor) buildCommand(runtime types.RuntimeConfig, files []types.FileEntry) string {
	var parts []string

	// For multi-file projects, find the entry point
	entryFile := runtime.DefaultFile
	foundEntry := false
	for _, f := range files {
		if f.IsEntryPoint {
			entryFile = f.Path
			foundEntry = true
			break
		}
	}

	// If no explicit entry point, try to find one matching the default name
	if !foundEntry {
		for _, f := range files {
			if f.Path == runtime.DefaultFile {
				foundEntry = true
				break
			}
		}
	}

	// If still no entry point, use the first file
	if !foundEntry && len(files) > 0 {
		entryFile = files[0].Path
	}

	// Compile step (if needed)
	if runtime.CompileCommand != "" {
		compileCmd := runtime.CompileCommand
		// Replace default filename with actual entry point
		compileCmd = strings.ReplaceAll(compileCmd, runtime.DefaultFile, entryFile)

		// For Java multi-file: compile all .java files
		if runtime.Language == types.Java {
			var javaFiles []string
			for _, f := range files {
				if strings.HasSuffix(f.Path, ".java") {
					javaFiles = append(javaFiles, f.Path)
				}
			}
			if len(javaFiles) > 0 {
				compileCmd = "javac " + strings.Join(javaFiles, " ")
			}
		}

		// For C++ multi-file: compile all .cpp files
		if runtime.Language == types.Cpp {
			var cppFiles []string
			for _, f := range files {
				if strings.HasSuffix(f.Path, ".cpp") || strings.HasSuffix(f.Path, ".cc") {
					cppFiles = append(cppFiles, f.Path)
				}
			}
			if len(cppFiles) > 0 {
				compileCmd = "g++ -std=c++17 -o /tmp/a.out " + strings.Join(cppFiles, " ")
			}
		}

		parts = append(parts, compileCmd)
	}

	// Run step
	runCmd := runtime.RunCommand
	// For Python, if the entry point changed, update the command
	runCmd = strings.ReplaceAll(runCmd, runtime.DefaultFile, entryFile)
	
	// For Java, need to handle class name from entry file
	if runtime.Language == types.Java {
		className := strings.TrimSuffix(entryFile, ".java")
		runCmd = fmt.Sprintf("java %s", className)
	}

	parts = append(parts, runCmd)

	return strings.Join(parts, " && ")
}

// parseDockerLogs separates Docker multiplexed log stream into stdout/stderr
func parseDockerLogs(data []byte, stdout, stderr *bytes.Buffer) {
	for len(data) >= 8 {
		// Docker log frame: [stream_type(1)][padding(3)][size(4)][payload]
		streamType := data[0]
		size := int(data[4])<<24 | int(data[5])<<16 | int(data[6])<<8 | int(data[7])
		data = data[8:]

		if size > len(data) {
			size = len(data)
		}
		if size <= 0 {
			continue
		}

		payload := data[:size]
		data = data[size:]

		switch streamType {
		case 1:
			stdout.Write(payload)
		case 2:
			stderr.Write(payload)
		default:
			stdout.Write(payload)
		}
	}
	// Remaining data without headers
	if len(data) > 0 {
		stdout.Write(data)
	}
}

func (e *Executor) Close() error {
	return e.docker.Close()
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
