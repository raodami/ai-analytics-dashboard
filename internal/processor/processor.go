package processor

import (
	"encoding/json"
	"fmt"
	"strings"

	"ai-analytics-dashboard/internal/datasource"
	"ai-analytics-dashboard/internal/llm"
	"ai-analytics-dashboard/internal/store"
)

type AnalyticsProcessor struct {
	store    *store.Store
	deepseek *llm.DeepSeekClient
}

type QueryResult struct {
	SQL       string          `json:"sql"`
	Data      json.RawMessage `json:"data"`
	ChartType string          `json:"chart_type"`
	Error     string          `json:"error,omitempty"`
}

func NewAnalyticsProcessor(s *store.Store) *AnalyticsProcessor {
	return &AnalyticsProcessor{
		store:    s,
		deepseek: llm.NewDeepSeekClient(),
	}
}

func (p *AnalyticsProcessor) IsConfigured() bool {
	return p.deepseek.IsConfigured()
}

func (p *AnalyticsProcessor) ProcessQuery(userID, naturalQuery, dataSourceID string) (*QueryResult, error) {
	var source *store.DataSource
	var err error

	if dataSourceID == "" {
		// Use default SQLite
		source = &store.DataSource{
			Type:       "sqlite",
			Connection: "data/app.db",
		}
	} else {
		sources, err := p.store.GetDataSources(userID)
		if err != nil {
			return nil, fmt.Errorf("failed to get data sources: %v", err)
		}

		found := false
		for _, s := range sources {
			if s.ID == dataSourceID {
				source = s
				found = true
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("data source not found")
		}
	}

	schema, err := datasource.GetSchemaByType(source.Type, source.Connection)
	if err != nil {
		return nil, fmt.Errorf("failed to get schema: %v", err)
	}

	sqlQuery, err := p.deepseek.GenerateSQL(llm.QueryRequest{
		NaturalLanguage: naturalQuery,
		Schema:          schema,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to generate SQL: %v", err)
	}

	data, err := datasource.ExecuteQueryByType(source.Type, source.Connection, sqlQuery)
	if err != nil {
		return &QueryResult{SQL: sqlQuery, Error: err.Error()}, nil
	}

	chartType := p.recommendChartType(data)

	return &QueryResult{
		SQL:       sqlQuery,
		Data:      data,
		ChartType: chartType,
	}, nil
}

func (p *AnalyticsProcessor) recommendChartType(data json.RawMessage) string {
	var rows []map[string]interface{}
	if err := json.Unmarshal(data, &rows); err != nil || len(rows) == 0 {
		return "table"
	}

	keys := make([]string, 0, len(rows[0]))
	for k := range rows[0] {
		keys = append(keys, k)
	}

	hasDate := false
	hasNumeric := false
	for _, row := range rows[:min(10, len(rows))] {
		for _, v := range row {
			switch v.(type) {
			case string:
				lower := strings.ToLower(v.(string))
				if strings.Contains(lower, "date") || strings.Contains(lower, "time") {
					hasDate = true
				}
			case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
				hasNumeric = true
			}
		}
		if hasDate && hasNumeric {
			break
		}
	}

	if hasDate && hasNumeric {
		return "line"
	}
	if hasNumeric {
		return "bar"
	}
	return "pie"
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
