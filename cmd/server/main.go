package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"ai-analytics-dashboard/internal/api"
	"ai-analytics-dashboard/internal/store"
	"ai-analytics-dashboard/internal/websocket"
)

func main() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "data/app.db"
	}

	db, err := store.NewDB(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Initialize WebSocket
	websocket.Init()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r := gin.Default()
	api.SetupRoutes(r, db)

	log.Printf("📊 AI Analytics Dashboard starting on :%s", port)
	log.Fatal(r.Run(":" + port))
}
