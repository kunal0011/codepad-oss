package types

import "time"

type Language string

const (
	Python     Language = "python"
	JavaScript Language = "javascript"
	TypeScript Language = "typescript"
	Java       Language = "java"
	Go         Language = "go"
	Cpp        Language = "cpp"
	Ruby       Language = "ruby"
	Rust       Language = "rust"
)

type ExecutionRequest struct {
	ExecutionID string     `json:"executionId" binding:"required"`
	Language    Language   `json:"language" binding:"required"`
	Files       []FileEntry `json:"files" binding:"required,min=1"`
	Stdin       string     `json:"stdin"`
	Timeout     int        `json:"timeout" binding:"required,min=1,max=60"`
	MemoryLimit int        `json:"memoryLimit"`
	CPULimit    int        `json:"cpuLimit"`
}

type FileEntry struct {
	Path       string `json:"path" binding:"required"`
	Content    string `json:"content"`
	IsEntryPoint bool `json:"isEntryPoint"`
}

type ExecutionResult struct {
	Stdout          string `json:"stdout"`
	Stderr          string `json:"stderr"`
	ExitCode        int    `json:"exitCode"`
	ExecutionTimeMs int64  `json:"executionTimeMs"`
	MemoryUsedBytes int64  `json:"memoryUsedBytes"`
}

type ContainerInfo struct {
	ID        string    `json:"id"`
	Language  Language  `json:"language"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

type RuntimeConfig struct {
	Language       Language `json:"language"`
	Version        string   `json:"version"`
	Image          string   `json:"image"`
	CompileCommand string   `json:"compileCommand,omitempty"`
	RunCommand     string   `json:"runCommand"`
	DefaultFile    string   `json:"defaultFile"`
}

var Runtimes = map[Language]RuntimeConfig{
	Python: {
		Language:    Python,
		Version:     "3.12",
		Image:       "python:3.12-slim",
		RunCommand:  "python3 main.py",
		DefaultFile: "main.py",
	},
	JavaScript: {
		Language:    JavaScript,
		Version:     "22",
		Image:       "node:22-slim",
		RunCommand:  "node index.js",
		DefaultFile: "index.js",
	},
	TypeScript: {
		Language:       TypeScript,
		Version:        "5.6",
		Image:          "node:22-slim",
		CompileCommand: "npx tsc --outDir /tmp/out index.ts",
		RunCommand:     "node /tmp/out/index.js",
		DefaultFile:    "index.ts",
	},
	Java: {
		Language:       Java,
		Version:        "21",
		Image:          "eclipse-temurin:21-jdk",
		CompileCommand: "javac Main.java",
		RunCommand:     "java Main",
		DefaultFile:    "Main.java",
	},
	Go: {
		Language:    Go,
		Version:     "1.23",
		Image:       "golang:1.23-alpine",
		RunCommand:  "go run main.go",
		DefaultFile: "main.go",
	},
	Cpp: {
		Language:       Cpp,
		Version:        "17",
		Image:          "gcc:14",
		CompileCommand: "g++ -std=c++17 -o /tmp/a.out main.cpp",
		RunCommand:     "/tmp/a.out",
		DefaultFile:    "main.cpp",
	},
	Ruby: {
		Language:    Ruby,
		Version:     "3.3",
		Image:       "ruby:3.3-slim",
		RunCommand:  "ruby main.rb",
		DefaultFile: "main.rb",
	},
	Rust: {
		Language:       Rust,
		Version:        "1.82",
		Image:          "rust:1.82-slim",
		CompileCommand: "rustc -o /tmp/a.out main.rs",
		RunCommand:     "/tmp/a.out",
		DefaultFile:    "main.rs",
	},
}
