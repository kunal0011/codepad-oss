package streaming

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/rs/zerolog/log"
)

// OutputConfig defines streaming limits
type OutputConfig struct {
	MaxBufferBytes     int     // Max total output (default 1MB)
	MaxRateBytesSec    int     // Sustained rate limit (default 10KB/s)
	MaxBurstBytes      int     // Burst allowance (default 50KB)
	ChunkSize          int     // Chunk size for streaming (default 4KB)
	FlushIntervalMs    int     // Flush interval (default 50ms)
	SanitizeHTML       bool    // Strip HTML/script tags
}

func DefaultConfig() OutputConfig {
	return OutputConfig{
		MaxBufferBytes:  1_048_576, // 1MB
		MaxRateBytesSec: 10_240,    // 10KB/s
		MaxBurstBytes:   51_200,    // 50KB
		ChunkSize:       4_096,     // 4KB
		FlushIntervalMs: 50,
		SanitizeHTML:    true,
	}
}

// OutputChunk represents a chunk of output
type OutputChunk struct {
	Stream    string `json:"stream"`    // "stdout" or "stderr"
	Data      string `json:"data"`
	Timestamp int64  `json:"timestamp"`
	Sequence  int    `json:"sequence"`
}

// StreamCallback is called for each output chunk
type StreamCallback func(chunk OutputChunk)

// OutputStreamer handles real-time output streaming with rate limiting and sanitization
type OutputStreamer struct {
	mu          sync.Mutex
	config      OutputConfig
	stdout      bytes.Buffer
	stderr      bytes.Buffer
	totalBytes  int
	truncated   bool
	sequence    int
	callback    StreamCallback
	rateBucket  int       // token bucket for rate limiting
	lastRefill  time.Time
	htmlRegex   *regexp.Regexp
	scriptRegex *regexp.Regexp
}

func NewStreamer(config OutputConfig, callback StreamCallback) *OutputStreamer {
	return &OutputStreamer{
		config:      config,
		callback:    callback,
		rateBucket:  config.MaxBurstBytes,
		lastRefill:  time.Now(),
		htmlRegex:   regexp.MustCompile(`<[^>]*>`),
		scriptRegex: regexp.MustCompile(`(?is)<script.*?>.*?</script>`),
	}
}

// ProcessDockerStream reads Docker multiplexed stream and streams output
func (s *OutputStreamer) ProcessDockerStream(ctx context.Context, reader io.Reader) error {
	buf := make([]byte, 8)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Read Docker log frame header (8 bytes)
		_, err := io.ReadFull(reader, buf)
		if err != nil {
			if err == io.EOF || err == io.ErrUnexpectedEOF {
				return nil
			}
			return err
		}

		// Parse header
		streamType := buf[0] // 1=stdout, 2=stderr
		size := int(buf[4])<<24 | int(buf[5])<<16 | int(buf[6])<<8 | int(buf[7])

		if size <= 0 || size > s.config.MaxBufferBytes {
			continue
		}

		// Read payload
		payload := make([]byte, size)
		n, err := io.ReadFull(reader, payload)
		if err != nil && err != io.ErrUnexpectedEOF {
			return err
		}
		payload = payload[:n]

		stream := "stdout"
		if streamType == 2 {
			stream = "stderr"
		}

		s.write(stream, payload)
	}
}

// ProcessRawStream reads raw (non-multiplexed) output
func (s *OutputStreamer) ProcessRawStream(ctx context.Context, reader io.Reader, stream string) error {
	buf := make([]byte, s.config.ChunkSize)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		n, err := reader.Read(buf)
		if n > 0 {
			s.write(stream, buf[:n])
		}
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
	}
}

func (s *OutputStreamer) write(stream string, data []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.truncated {
		return
	}

	// Check total buffer limit
	remaining := s.config.MaxBufferBytes - s.totalBytes
	if remaining <= 0 {
		s.truncated = true
		truncMsg := "\n[output truncated - exceeded 1MB limit]"
		s.emitChunk(stream, []byte(truncMsg))
		return
	}

	if len(data) > remaining {
		data = data[:remaining]
		s.truncated = true
	}

	// Rate limiting (token bucket)
	s.refillBucket()
	if len(data) > s.rateBucket {
		// Rate limited: only send what the bucket allows
		data = data[:s.rateBucket]
	}
	s.rateBucket -= len(data)

	// Sanitize
	if s.config.SanitizeHTML {
		data = s.sanitize(data)
	}

	// Handle binary output
	if !utf8.Valid(data) {
		data = s.hexDump(data)
	}

	// Buffer and emit
	if stream == "stderr" {
		s.stderr.Write(data)
	} else {
		s.stdout.Write(data)
	}
	s.totalBytes += len(data)

	s.emitChunk(stream, data)
}

func (s *OutputStreamer) emitChunk(stream string, data []byte) {
	if s.callback != nil && len(data) > 0 {
		s.sequence++
		s.callback(OutputChunk{
			Stream:    stream,
			Data:      string(data),
			Timestamp: time.Now().UnixMilli(),
			Sequence:  s.sequence,
		})
	}
}

func (s *OutputStreamer) refillBucket() {
	now := time.Now()
	elapsed := now.Sub(s.lastRefill).Seconds()
	s.lastRefill = now

	refill := int(elapsed * float64(s.config.MaxRateBytesSec))
	s.rateBucket += refill
	if s.rateBucket > s.config.MaxBurstBytes {
		s.rateBucket = s.config.MaxBurstBytes
	}
}

func (s *OutputStreamer) sanitize(data []byte) []byte {
	// Remove script tags first (multiline)
	data = s.scriptRegex.ReplaceAll(data, []byte{})
	// Remove remaining HTML tags
	data = s.htmlRegex.ReplaceAll(data, []byte{})
	return data
}

func (s *OutputStreamer) hexDump(data []byte) []byte {
	var buf bytes.Buffer
	buf.WriteString("[binary output - hex dump]\n")
	for i, b := range data {
		if i > 0 && i%16 == 0 {
			buf.WriteByte('\n')
		}
		fmt.Fprintf(&buf, "%02x ", b)
		if i >= 256 {
			buf.WriteString("\n... (truncated)")
			break
		}
	}
	buf.WriteByte('\n')
	return buf.Bytes()
}

// GetStdout returns the buffered stdout
func (s *OutputStreamer) GetStdout() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.stdout.String()
}

// GetStderr returns the buffered stderr
func (s *OutputStreamer) GetStderr() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.stderr.String()
}

// IsTruncated returns whether output was truncated
func (s *OutputStreamer) IsTruncated() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.truncated
}

// TotalBytes returns total bytes processed
func (s *OutputStreamer) TotalBytes() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.totalBytes
}

// MarshalChunks serializes all chunks to JSON for WebSocket delivery
func MarshalChunks(chunks []OutputChunk) ([]byte, error) {
	return json.Marshal(chunks)
}

// WebSocketBroadcaster creates a callback that sends chunks over WebSocket
func WebSocketBroadcaster(executionID string, sendFn func(data []byte)) StreamCallback {
	return func(chunk OutputChunk) {
		msg := struct {
			Event       string      `json:"event"`
			ExecutionID string      `json:"executionId"`
			Chunk       OutputChunk `json:"chunk"`
		}{
			Event:       "exec:output",
			ExecutionID: executionID,
			Chunk:       chunk,
		}

		data, err := json.Marshal(msg)
		if err != nil {
			log.Error().Err(err).Msg("Failed to marshal output chunk")
			return
		}
		sendFn(data)
	}
}
