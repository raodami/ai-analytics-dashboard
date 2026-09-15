package stripe

import (
	"fmt"
	"os"

	"github.com/stripe/stripe-go/v80"
	"github.com/stripe/stripe-go/v80/checkout/session"
)

type Client struct {
	apiKey string
}

type Price struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Price string `json:"price"`
}

func NewClient() *Client {
	return &Client{
		apiKey: os.Getenv("STRIPE_SECRET_KEY"),
	}
}

func (c *Client) IsConfigured() bool {
	return c.apiKey != ""
}

func (c *Client) Setup() error {
	stripe.Key = c.apiKey
	return nil
}

func (c *Client) GetPlans() []Price {
	return []Price{
		{ID: "free", Name: "Free", Price: "0"},
		{ID: "pro", Name: "Pro", Price: "1900"},
		{ID: "team", Name: "Team", Price: "4900"},
	}
}

func (c *Client) CreateCheckoutSession(customerEmail, userID, planID string) (string, error) {
	if !c.IsConfigured() {
		return "", fmt.Errorf("Stripe not configured")
	}

	priceID := "price_pro_monthly"
	if planID == "team" {
		priceID = "price_team_monthly"
	}

	params := &stripe.CheckoutSessionParams{
		CustomerEmail: stripe.String(customerEmail),
		Mode:          stripe.String("subscription"),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(priceID),
				Quantity: stripe.Int64(1),
			},
		},
		SuccessURL: stripe.String(fmt.Sprintf("https://your-domain.com/dashboard?success=true")),
		CancelURL:  stripe.String("https://your-domain.com/pricing?canceled=true"),
		Metadata: map[string]string{
			"user_id": userID,
		},
	}

	sess, err := session.New(params)
	if err != nil {
		return "", err
	}

	return sess.URL, nil
}

func (c *Client) GetUsageLimit(planID string) int {
	switch planID {
	case "pro", "team":
		return -1 // unlimited
	default:
		return 10 // free tier
	}
}
