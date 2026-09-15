package stripe

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
)

type WebhookConfig struct {
	EndpointSecret string
}

type WebhookEvent struct {
	Type      string          `json:"type"`
	Object    json.RawMessage `json:"object"`
}

type SubscriptionData struct {
	Metadata map[string]string `json:"metadata"`
	Status   string            `json:"status"`
	PlanID   string            `json:"plan_id"`
}

func NewWebhookConfig() *WebhookConfig {
	return &WebhookConfig{
		EndpointSecret: os.Getenv("STRIPE_WEBHOOK_SECRET"),
	}
}

func (w *WebhookConfig) IsConfigured() bool {
	return w.EndpointSecret != ""
}

func (w *WebhookConfig) VerifySignature(payload []byte, signature string) (bool, error) {
	if !w.IsConfigured() {
		return false, nil
	}

	hmacDigest := hmac.New(sha256.New, []byte(w.EndpointSecret))
	hmacDigest.Write(payload)
	expectedSig := fmt.Sprintf("sha256=%x", hmacDigest.Sum(nil))

	return hmac.Equal([]byte(expectedSig), []byte(signature)), nil
}

func (w *WebhookConfig) ParseEvent(payload []byte) (*WebhookEvent, error) {
	var event WebhookEvent
	if err := json.Unmarshal(payload, &event); err != nil {
		return nil, fmt.Errorf("failed to parse webhook event: %w", err)
	}
	return &event, nil
}

func (w *WebhookConfig) HandleSubscriptionUpdated(event *WebhookEvent, userID string) (string, error) {
	if event.Type != "customer.subscription.updated" && event.Type != "customer.subscription.created" {
		return "", nil
	}

	var data SubscriptionData
	if err := json.Unmarshal(event.Object, &data); err != nil {
		return "", fmt.Errorf("failed to unmarshal subscription data: %w", err)
	}

	switch data.Status {
	case "active":
		return userID, nil
	case "canceled", "incomplete_expired", "trial_expired":
		return userID, nil
	}

	return "", nil
}

func (w *WebhookConfig) HandleCheckoutCompleted(event *WebhookEvent) (string, error) {
	if event.Type != "checkout.session.completed" {
		return "", nil
	}

	var session struct {
		Customer   string            `json:"customer"`
		Metadata   map[string]string `json:"metadata"`
		Subscription string        `json:"subscription"`
	}
	if err := json.Unmarshal(event.Object, &session); err != nil {
		return "", err
	}

	userID := session.Metadata["user_id"]
	if userID == "" {
		return "", fmt.Errorf("no user_id in checkout metadata")
	}

	return userID, nil
}

func (w *WebhookConfig) HandleCustomerDeleted(event *WebhookEvent) error {
	if event.Type != "customer.deleted" {
		return nil
	}

	var customer struct {
		ID       string            `json:"id"`
		Metadata map[string]string `json:"metadata"`
	}
	if err := json.Unmarshal(event.Object, &customer); err != nil {
		return err
	}

	return fmt.Errorf("delete_customer_subscription: %s", customer.ID)
}
