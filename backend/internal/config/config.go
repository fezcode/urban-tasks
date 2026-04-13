package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port            int
	DatabaseURL     string
	JWTSecret       string
	JWTAccessTTL    time.Duration
	JWTRefreshTTL   time.Duration
	AllowedOrigins  []string
	MigrationsPath  string
	Environment     string
	RateLimitRPS    int
	ShutdownTimeout time.Duration
}

func Load() (*Config, error) {
	port, _ := strconv.Atoi(getEnv("PORT", "8080"))
	rateLimit, _ := strconv.Atoi(getEnv("RATE_LIMIT_RPS", "100"))

	dbURL := getEnv("DATABASE_URL", "")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	jwtSecret := getEnv("JWT_SECRET", "")
	if jwtSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	accessTTL, _ := time.ParseDuration(getEnv("JWT_ACCESS_TTL", "15m"))
	refreshTTL, _ := time.ParseDuration(getEnv("JWT_REFRESH_TTL", "168h"))
	shutdownTimeout, _ := time.ParseDuration(getEnv("SHUTDOWN_TIMEOUT", "10s"))

	origins := splitCSV(getEnv("ALLOWED_ORIGINS", "http://localhost:5173"))

	return &Config{
		Port:            port,
		DatabaseURL:     dbURL,
		JWTSecret:       jwtSecret,
		JWTAccessTTL:    accessTTL,
		JWTRefreshTTL:   refreshTTL,
		AllowedOrigins:  origins,
		MigrationsPath:  getEnv("MIGRATIONS_PATH", "file://migrations"),
		Environment:     getEnv("ENVIRONMENT", "development"),
		RateLimitRPS:    rateLimit,
		ShutdownTimeout: shutdownTimeout,
	}, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func splitCSV(s string) []string {
	var result []string
	for _, part := range splitOn(s, ',') {
		trimmed := trim(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func splitOn(s string, sep byte) []string {
	var parts []string
	start := 0
	for i := range len(s) {
		if s[i] == sep {
			parts = append(parts, s[start:i])
			start = i + 1
		}
	}
	parts = append(parts, s[start:])
	return parts
}

func trim(s string) string {
	start, end := 0, len(s)
	for start < end && s[start] == ' ' {
		start++
	}
	for end > start && s[end-1] == ' ' {
		end--
	}
	return s[start:end]
}
