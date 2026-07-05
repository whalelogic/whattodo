package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/whalelogic/whattodo/config"
	"github.com/whalelogic/whattodo/router"
)

func main() {

	config := config.DefaultConfig()
	r := router.New(config)

	server := &http.Server{
		Addr:         fmt.Sprintf(":%v", config.Port),
		Handler:      r,
		ReadTimeout:  config.ReadTimeout,
		WriteTimeout: config.WriteTimeout,
	}

	fmt.Printf(
		"\n<--- What to Do --->\nAddr: http://localhost:%v\nPages: /, /about, /contact\nAPI: /api/v1/chat/stream\nGemini Model: %s\nRead Timeout: %v\n",
		config.Port,
		config.GeminiModel,
		config.ReadTimeout,
	)

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("listen: %s\n", err)
	}

}
