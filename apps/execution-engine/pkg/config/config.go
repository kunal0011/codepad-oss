package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port              int
	MaxContainerMemMB int64
	MaxContainerCPU   int64
	MaxOutputBytes    int
	IdleTimeoutSec    int
	MaxLifetimeSec    int
	PoolSize          int
	DockerSocket      string
}

func Load() *Config {
	return &Config{
		Port:              getEnvInt("EXEC_PORT", 8081),
		MaxContainerMemMB: int64(getEnvInt("MAX_CONTAINER_MEMORY_MB", 512)),
		MaxContainerCPU:   int64(getEnvInt("MAX_CONTAINER_CPU_CORES", 1)),
		MaxOutputBytes:    getEnvInt("MAX_OUTPUT_BUFFER_BYTES", 1048576),
		IdleTimeoutSec:    getEnvInt("CONTAINER_IDLE_TIMEOUT_SEC", 1800),
		MaxLifetimeSec:    getEnvInt("CONTAINER_MAX_LIFETIME_SEC", 3600),
		PoolSize:          getEnvInt("CONTAINER_POOL_SIZE", 5),
		DockerSocket:      getEnvStr("DOCKER_SOCKET", "/var/run/docker.sock"),
	}
}

func getEnvStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}
