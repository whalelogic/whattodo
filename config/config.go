// Package config provides configuration settings
package config

import (
	"os"
	"time"
)

// Config holds all application settings
type Config struct {
	Mode           string // gin.DebugMode, gin.ReleaseMode, gin.TestMode
	Port           string
	AllowedOrigins []string
	ReadTimeout    time.Duration
	WriteTimeout   time.Duration
	GeminiAPIKey   string
	GeminiModel    string
}

// DefaultConfig returns sane defaults for local development
func DefaultConfig() *Config {
	model := os.Getenv("GEMINI_MODEL")
	if model == "" {
		model = "gemini-1.5-flash"
	}
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		// Backward-compatible fallback for common typo in local env setup.
		apiKey = os.Getenv("GEMININ_API_KEY")
	}

	return &Config{
		Mode:           "debug",
		Port:           "8080",
		AllowedOrigins: []string{"*"},
		ReadTimeout:    30 * time.Second,
		WriteTimeout:   2 * time.Minute,
		GeminiAPIKey:   apiKey,
		GeminiModel:    model,
	}
}
