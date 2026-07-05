// Package router provides the HTTP router
package router

import (
	"github.com/gin-gonic/gin"

	"github.com/whalelogic/whattodo/config"
	"github.com/whalelogic/whattodo/handlers"
	"github.com/whalelogic/whattodo/middleware"
)

// New builds and returns a configured Gin engine
func New(cfg *config.Config) *gin.Engine {
	gin.SetMode(cfg.Mode)

	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(middleware.CORS(cfg.AllowedOrigins))
	r.Static("/static", "./static")

	r.GET("/health", handlers.Health)
	r.GET("/", handlers.HomePage)
	r.GET("/about", handlers.AboutPage)
	r.GET("/contact", handlers.ContactPage)

	api := r.Group("/api/v1")
	{
		api.POST("/chat", handlers.Chat)
		api.POST("/chat/stream", handlers.ChatStream(cfg))
	}

	return r
}
