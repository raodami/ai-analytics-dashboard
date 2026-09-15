package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Client struct {
	conn   *websocket.Conn
	send   chan []byte
	userID string
	mu     sync.Mutex
}

type Hub struct {
	clients    map[string]*Client
	mu         sync.RWMutex
	register   chan *Client
	unregister chan *Client
	broadcast  chan message
}

type message struct {
	UserID string          `json:"user_id"`
	Data   json.RawMessage `json:"data"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan message, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.conn.RemoteAddr().String()] = client
			h.mu.Unlock()
			log.Printf("Client registered: %s", client.conn.RemoteAddr().String())

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.conn.RemoteAddr().String()]; ok {
				delete(h.clients, client.conn.RemoteAddr().String())
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("Client unregistered: %s", client.conn.RemoteAddr().String())

		case msg := <-h.broadcast:
			h.mu.RLock()
			for _, client := range h.clients {
				if msg.UserID == "" || client.userID == msg.UserID {
					select {
					case client.send <- msg.Data:
					default:
						close(client.send)
						delete(h.clients, client.conn.RemoteAddr().String())
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) SendToUser(userID string, data interface{}) {
	payload, _ := json.Marshal(data)
	h.broadcast <- message{UserID: userID, Data: payload}
}

func (h *Hub) SendBroadcast(data interface{}) {
	payload, _ := json.Marshal(data)
	h.broadcast <- message{UserID: "", Data: payload}
}

func Upgrade(w http.ResponseWriter, r *http.Request, hub *Hub, userID string) (*Client, error) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return nil, err
	}

	client := &Client{
		conn:   conn,
		send:   make(chan []byte, 256),
		userID: userID,
	}

	hub.register <- client

	go client.writePump()
	go client.readPump(hub)

	return client, nil
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.mu.Lock()
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				c.mu.Unlock()
				return
			}
			c.mu.Unlock()
		case <-ticker.C:
			c.mu.Lock()
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				c.mu.Unlock()
				return
			}
			c.mu.Unlock()
		}
	}
}

func (c *Client) readPump(hub *Hub) {
	defer func() {
		hub.unregister <- c
		c.conn.Close()
	}()

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
	}
}

func GetClientKey(userID string, sessionID string) string {
	return userID + ":" + sessionID
}
