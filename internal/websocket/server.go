package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

var hub *Hub

func Init() {
	hub = NewHub()
	go hub.Run()
	log.Println("WebSocket hub initialized")
}

func GetHub() *Hub {
	return hub
}

func RegisterWebSocket(c *gin.Context) {
	userID := c.GetString("user_id")
	client, err := Upgrade(c.Writer, c.Request, hub, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Send initial connection message
	payload, _ := json.Marshal(gin.H{
		"type":      "connected",
		"user_id":   userID,
		"timestamp": time.Now().Unix(),
	})
	client.send <- payload
}

func SendQueryProgress(userID string, queryID string, progress int) {
	hub.SendToUser(userID, gin.H{
		"type":     "query_progress",
		"query_id": queryID,
		"progress": progress,
		"message":  formatProgressMessage(progress),
	})
}

func SendQueryComplete(userID string, queryID string, result interface{}) {
	hub.SendToUser(userID, gin.H{
		"type":     "query_complete",
		"query_id": queryID,
		"result":   result,
	})
}

func SendQueryError(userID string, queryID string, errMsg string) {
	hub.SendToUser(userID, gin.H{
		"type":     "query_error",
		"query_id": queryID,
		"error":    errMsg,
	})
}

func SendReportGenerated(userID string, reportID string, report interface{}) {
	hub.SendToUser(userID, gin.H{
		"type":      "report_generated",
		"report_id": reportID,
		"report":    report,
	})
}

func SendNotification(userID string, notification interface{}) {
	hub.SendToUser(userID, gin.H{
		"type":   "notification",
		"data":   notification,
	})
}

func formatProgressMessage(progress int) string {
	switch {
	case progress < 20:
		return "Starting query analysis..."
	case progress < 40:
		return "Generating SQL..."
	case progress < 60:
		return "Querying database..."
	case progress < 80:
		return "Processing results..."
	case progress < 100:
		return "Rendering chart..."
	default:
		return "Complete!"
	}
}
