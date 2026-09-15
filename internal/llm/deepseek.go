package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

type DeepSeekClient struct {
	apiKey string
	client *http.Client
}

type QueryRequest struct {
	NaturalLanguage string `json:"natural_language"`
	Schema          string `json:"schema"`
}

func NewDeepSeekClient() *DeepSeekClient {
	return &DeepSeekClient{
		apiKey: os.Getenv("DEEPSEEK_API_KEY"),
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *DeepSeekClient) IsConfigured() bool {
	return c.apiKey != ""
}

func (c *DeepSeekClient) GenerateSQL(request QueryRequest) (string, error) {
	if !c.IsConfigured() {
		return "", fmt.Errorf("DeepSeek API key not configured")
	}

	prompt := fmt.Sprintf(`You are a SQL generator. Convert the following natural language query to SQL.

Database schema:
%s

Natural language query: %s

Return ONLY the SQL query, nothing else.`, request.Schema, request.NaturalLanguage)

	body, _ := json.Marshal(map[string]interface{}{
		"model": "deepseek-chat",
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
		"max_tokens": 500,
		"temperature": 0.2,
	})

	resp, err := c.client.Post("https://api.deepseek.com/v1/chat/completions", "application/json", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	responseBody, _ := io.ReadAll(resp.Body)
	
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	json.Unmarshal(responseBody, &result)

	if len(result.Choices) > 0 {
		sql := result.Choices[0].Message.Content
		sql = trimSQL(sql)
		return sql, nil
	}

	return "", fmt.Errorf("no SQL generated")
}

func trimSQL(sql string) string {
	sqlBytes := []byte(sql)
	sqlBytes = bytes.TrimSpace(sqlBytes)
	
	start := bytes.Index(sqlBytes, []byte("```"))
	if start >= 0 {
		end := bytes.Index(sqlBytes[start:], []byte("```"))
		if end >= 0 {
			sqlBytes = sqlBytes[start+3 : start+end]
		}
	}
	
	sqlBytes = bytes.TrimSpace(sqlBytes)
	return string(sqlBytes)
}
