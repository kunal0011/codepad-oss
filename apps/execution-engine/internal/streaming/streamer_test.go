package streaming

import (
	"strings"
	"sync"
	"testing"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()
	if cfg.MaxBufferBytes != 1_048_576 {
		t.Errorf("Expected MaxBufferBytes 1MB, got %d", cfg.MaxBufferBytes)
	}
	if cfg.MaxRateBytesSec != 10_240 {
		t.Errorf("Expected MaxRateBytesSec 10KB, got %d", cfg.MaxRateBytesSec)
	}
}

func TestStreamer_BasicOutput(t *testing.T) {
	var chunks []OutputChunk
	var mu sync.Mutex

	s := NewStreamer(DefaultConfig(), func(chunk OutputChunk) {
		mu.Lock()
		chunks = append(chunks, chunk)
		mu.Unlock()
	})

	s.write("stdout", []byte("Hello, World!\n"))

	if s.GetStdout() != "Hello, World!\n" {
		t.Errorf("Expected 'Hello, World!\\n', got '%s'", s.GetStdout())
	}
	if s.GetStderr() != "" {
		t.Errorf("Expected empty stderr, got '%s'", s.GetStderr())
	}
	if len(chunks) != 1 {
		t.Fatalf("Expected 1 chunk, got %d", len(chunks))
	}
	if chunks[0].Stream != "stdout" {
		t.Errorf("Expected stream 'stdout', got '%s'", chunks[0].Stream)
	}
}

func TestStreamer_StderrSeparation(t *testing.T) {
	s := NewStreamer(DefaultConfig(), nil)

	s.write("stdout", []byte("output"))
	s.write("stderr", []byte("error"))

	if s.GetStdout() != "output" {
		t.Errorf("Expected stdout 'output', got '%s'", s.GetStdout())
	}
	if s.GetStderr() != "error" {
		t.Errorf("Expected stderr 'error', got '%s'", s.GetStderr())
	}
}

func TestStreamer_HTMLSanitization(t *testing.T) {
	cfg := DefaultConfig()
	cfg.SanitizeHTML = true
	s := NewStreamer(cfg, nil)

	s.write("stdout", []byte(`Hello <script>alert('xss')</script> World`))

	output := s.GetStdout()
	if strings.Contains(output, "<script>") {
		t.Errorf("Output should not contain script tags: %s", output)
	}
	if strings.Contains(output, "alert") {
		t.Errorf("Output should not contain script content: %s", output)
	}
	if !strings.Contains(output, "Hello") || !strings.Contains(output, "World") {
		t.Errorf("Output should retain non-HTML content: %s", output)
	}
}

func TestStreamer_HTMLTagStripping(t *testing.T) {
	cfg := DefaultConfig()
	cfg.SanitizeHTML = true
	s := NewStreamer(cfg, nil)

	s.write("stdout", []byte(`<b>bold</b> <img src="x"> normal`))

	output := s.GetStdout()
	if strings.Contains(output, "<b>") || strings.Contains(output, "<img") {
		t.Errorf("HTML tags should be stripped: %s", output)
	}
}

func TestStreamer_Truncation(t *testing.T) {
	cfg := DefaultConfig()
	cfg.MaxBufferBytes = 100 // Very small limit
	cfg.MaxBurstBytes = 200
	s := NewStreamer(cfg, nil)

	// Write more than the limit
	data := strings.Repeat("x", 200)
	s.write("stdout", []byte(data))

	if !s.IsTruncated() {
		t.Error("Expected output to be truncated")
	}
	if s.TotalBytes() > cfg.MaxBufferBytes+100 { // allow for truncation message
		t.Errorf("Total bytes %d should not greatly exceed limit %d", s.TotalBytes(), cfg.MaxBufferBytes)
	}
}

func TestStreamer_ChunkSequence(t *testing.T) {
	var chunks []OutputChunk
	var mu sync.Mutex

	s := NewStreamer(DefaultConfig(), func(chunk OutputChunk) {
		mu.Lock()
		chunks = append(chunks, chunk)
		mu.Unlock()
	})

	s.write("stdout", []byte("line1\n"))
	s.write("stdout", []byte("line2\n"))
	s.write("stderr", []byte("err1\n"))

	mu.Lock()
	defer mu.Unlock()

	if len(chunks) != 3 {
		t.Fatalf("Expected 3 chunks, got %d", len(chunks))
	}
	if chunks[0].Sequence != 1 || chunks[1].Sequence != 2 || chunks[2].Sequence != 3 {
		t.Errorf("Chunks should be sequentially numbered")
	}
	if chunks[2].Stream != "stderr" {
		t.Errorf("Third chunk should be stderr")
	}
}

func TestStreamer_NoCallbackStillBuffers(t *testing.T) {
	s := NewStreamer(DefaultConfig(), nil)

	s.write("stdout", []byte("buffered"))

	if s.GetStdout() != "buffered" {
		t.Errorf("Should buffer even without callback")
	}
}
