package executor

import (
	"bytes"
	"strings"
	"testing"

	"github.com/codepad/execution-engine/pkg/types"
)

func TestValidateFiles_Empty(t *testing.T) {
	e := &Executor{}
	err := e.validateFiles(nil)
	if err == nil {
		t.Error("Expected error for empty files")
	}
}

func TestValidateFiles_TooMany(t *testing.T) {
	e := &Executor{}
	files := make([]types.FileEntry, 51)
	for i := range files {
		files[i] = types.FileEntry{Path: "file.txt", Content: "x"}
	}
	err := e.validateFiles(files)
	if err == nil {
		t.Error("Expected error for too many files")
	}
	if !strings.Contains(err.Error(), "50") {
		t.Errorf("Error should mention limit of 50: %s", err.Error())
	}
}

func TestValidateFiles_PathTraversal(t *testing.T) {
	e := &Executor{}
	tests := []struct {
		path    string
		invalid bool
	}{
		{"main.py", false},
		{"src/utils.py", false},
		{"../etc/passwd", true},
		{"/etc/passwd", true},
		{"../../secret.txt", true},
	}

	for _, tt := range tests {
		files := []types.FileEntry{{Path: tt.path, Content: "x"}}
		err := e.validateFiles(files)
		if tt.invalid && err == nil {
			t.Errorf("Expected error for path %q", tt.path)
		}
		if !tt.invalid && err != nil {
			t.Errorf("Unexpected error for path %q: %v", tt.path, err)
		}
	}
}

func TestValidateFiles_SizeLimit(t *testing.T) {
	e := &Executor{}
	// 11MB file should be rejected
	bigContent := strings.Repeat("x", 11*1024*1024)
	files := []types.FileEntry{{Path: "big.txt", Content: bigContent}}
	err := e.validateFiles(files)
	if err == nil {
		t.Error("Expected error for oversized file")
	}
}

func TestBuildCommand_SingleFile(t *testing.T) {
	e := &Executor{}
	runtime := types.RuntimeConfig{
		Language:    types.Python,
		RunCommand:  "python3 main.py",
		DefaultFile: "main.py",
	}
	files := []types.FileEntry{
		{Path: "main.py", Content: "print('hello')", IsEntryPoint: true},
	}

	cmd := e.buildCommand(runtime, files)
	if cmd != "python3 main.py" {
		t.Errorf("Expected 'python3 main.py', got '%s'", cmd)
	}
}

func TestBuildCommand_CompileAndRun(t *testing.T) {
	e := &Executor{}
	runtime := types.RuntimeConfig{
		Language:       types.Cpp,
		CompileCommand: "g++ -std=c++17 -o /tmp/a.out main.cpp",
		RunCommand:     "/tmp/a.out",
		DefaultFile:    "main.cpp",
	}
	files := []types.FileEntry{
		{Path: "main.cpp", Content: "#include <iostream>", IsEntryPoint: true},
	}

	cmd := e.buildCommand(runtime, files)
	if !strings.Contains(cmd, "&&") {
		t.Errorf("Expected compile && run, got '%s'", cmd)
	}
	if !strings.Contains(cmd, "g++") {
		t.Errorf("Expected g++ in command, got '%s'", cmd)
	}
}

func TestBuildCommand_CustomEntryPoint(t *testing.T) {
	e := &Executor{}
	runtime := types.RuntimeConfig{
		Language:    types.Python,
		RunCommand:  "python3 main.py",
		DefaultFile: "main.py",
	}
	files := []types.FileEntry{
		{Path: "app.py", Content: "print('app')", IsEntryPoint: true},
		{Path: "utils.py", Content: "def helper(): pass"},
	}

	cmd := e.buildCommand(runtime, files)
	if cmd != "python3 app.py" {
		t.Errorf("Expected 'python3 app.py', got '%s'", cmd)
	}
}

func TestBuildCommand_JavaMultiFile(t *testing.T) {
	e := &Executor{}
	runtime := types.RuntimeConfig{
		Language:       types.Java,
		CompileCommand: "javac Main.java",
		RunCommand:     "java Main",
		DefaultFile:    "Main.java",
	}
	files := []types.FileEntry{
		{Path: "Main.java", Content: "class Main {}", IsEntryPoint: true},
		{Path: "Helper.java", Content: "class Helper {}"},
	}

	cmd := e.buildCommand(runtime, files)
	if !strings.Contains(cmd, "Main.java") || !strings.Contains(cmd, "Helper.java") {
		t.Errorf("Java multi-file should compile all .java files: '%s'", cmd)
	}
}

func TestBuildCommand_CppMultiFile(t *testing.T) {
	e := &Executor{}
	runtime := types.RuntimeConfig{
		Language:       types.Cpp,
		CompileCommand: "g++ -std=c++17 -o /tmp/a.out main.cpp",
		RunCommand:     "/tmp/a.out",
		DefaultFile:    "main.cpp",
	}
	files := []types.FileEntry{
		{Path: "main.cpp", Content: "#include \"utils.h\"", IsEntryPoint: true},
		{Path: "utils.cpp", Content: "void helper() {}"},
		{Path: "utils.h", Content: "void helper();"},
	}

	cmd := e.buildCommand(runtime, files)
	if !strings.Contains(cmd, "main.cpp") || !strings.Contains(cmd, "utils.cpp") {
		t.Errorf("C++ multi-file should compile all .cpp files: '%s'", cmd)
	}
	// Header files should NOT be in compile command
	if strings.Contains(cmd, "utils.h") {
		t.Errorf("Header files should not be in compile command: '%s'", cmd)
	}
}

func TestParseDockerLogs(t *testing.T) {
	// Build a mock Docker log frame
	// Frame: [type(1)] [pad(3)] [size(4)] [payload]
	payload := []byte("Hello from stdout\n")
	frame := make([]byte, 8+len(payload))
	frame[0] = 1 // stdout
	frame[4] = byte(len(payload) >> 24)
	frame[5] = byte(len(payload) >> 16)
	frame[6] = byte(len(payload) >> 8)
	frame[7] = byte(len(payload))
	copy(frame[8:], payload)

	// Add stderr frame
	errPayload := []byte("Error output\n")
	errFrame := make([]byte, 8+len(errPayload))
	errFrame[0] = 2 // stderr
	errFrame[4] = byte(len(errPayload) >> 24)
	errFrame[5] = byte(len(errPayload) >> 16)
	errFrame[6] = byte(len(errPayload) >> 8)
	errFrame[7] = byte(len(errPayload))
	copy(errFrame[8:], errPayload)

	combined := append(frame, errFrame...)

	var stdout, stderr bytes.Buffer
	parseDockerLogs(combined, &stdout, &stderr)

	if stdout.String() != "Hello from stdout\n" {
		t.Errorf("Expected 'Hello from stdout\\n', got '%s'", stdout.String())
	}
	if stderr.String() != "Error output\n" {
		t.Errorf("Expected 'Error output\\n', got '%s'", stderr.String())
	}
}
