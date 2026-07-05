// Package handlers contains the HTTP handlers
package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/whalelogic/whattodo/config"
	"github.com/whalelogic/whattodo/llm"
	"github.com/whalelogic/whattodo/views"
)

// Health is a simple liveness check
func Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "what-to-do"})
}

// Chat is a placeholder — will call the LLM provider later
func Chat(c *gin.Context) {
	var req struct {
		Message string `json:"message" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"reply": "You said: " + req.Message + " — soon I'll know all the best things to do in CT!",
	})
}

func ChatStream(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Message string `json:"message" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")
		c.Header("X-Accel-Buffering", "no")
		c.Status(http.StatusOK)

		flusher, ok := c.Writer.(http.Flusher)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "streaming is not supported"})
			return
		}

		deltaCh, resultCh, errCh := llm.StreamGemini(
			c.Request.Context(),
			cfg.GeminiAPIKey,
			cfg.GeminiModel,
			req.Message,
		)

		for deltaCh != nil || resultCh != nil || errCh != nil {
			select {
			case <-c.Request.Context().Done():
				return
			case delta, ok := <-deltaCh:
				if !ok {
					deltaCh = nil
					continue
				}
				if err := writeSSE(c.Writer, "chunk", map[string]string{"delta": delta}); err != nil {
					return
				}
				flusher.Flush()
			case result, ok := <-resultCh:
				if !ok {
					resultCh = nil
					continue
				}
				if err := writeSSE(c.Writer, "done", result); err != nil {
					return
				}
				flusher.Flush()
			case err, ok := <-errCh:
				if !ok {
					errCh = nil
					continue
				}
				_ = writeSSE(c.Writer, "error", map[string]string{"error": err.Error()})
				flusher.Flush()
				return
			}
		}
	}
}

func HomePage(c *gin.Context) {
	views.Home().Render(c.Request.Context(), c.Writer)
}

func Ping(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "pong"})
}

func AboutPage(c *gin.Context) {
	views.About().Render(c.Request.Context(), c.Writer)
}

func ContactPage(c *gin.Context) {
	views.Contact().Render(c.Request.Context(), c.Writer)
}

func writeSSE(w http.ResponseWriter, event string, payload any) error {
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "event: %s\n", event); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "data: %s\n\n", b); err != nil {
		return err
	}
	return nil
}
