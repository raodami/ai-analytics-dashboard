package processor

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

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
	source, err := p.getDataSource(dataSourceID)
	if err != nil {
		return nil, fmt.Errorf("data source not found")
	}

	schema, err := p.getSchema(source)
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

	data, err := p.executeQuery(source, sqlQuery)
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

func (p *AnalyticsProcessor) getDataSource(id string) (*store.DataSource, error) {
	return &store.DataSource{
		Type:       "sqlite",
		Connection: "data/app.db",
	}, nil
}

func (p *AnalyticsProcessor) getSchema(source *store.DataSource) (string, error) {
	db, err := sql.Open("sqlite", source.Connection)
	if err != nil {
		return "", err
	}
	defer db.Close()

	rows, err := db.Query("SELECT name FROM sqlite_master WHERE type='table'")
	if err != nil {
		return "", err
	}
	defer rows.Close()

	var schema strings.Builder
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			continue
		}
		schema.WriteString(fmt.Sprintf("Table: %s\n", tableName))

		colRows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s)", tableName))
		if err != nil {
			continue
		}
		for colRows.Next() {
			var cid int
			var columnName, colType string
			var notnull int
			var dfltValue sql.NullString
			var pk int
			if err := colRows.Scan(&cid, &columnName, &colType, &notnull, &dfltValue, &pk); err != nil {
				continue
			}
			schema.WriteString(fmt.Sprintf("  - %s %s\n", columnName, colType))
		}
		colRows.Close()
	}

	return schema.String(), nil
}

func (p *AnalyticsProcessor) executeQuery(source *store.DataSource, query string) (json.RawMessage, error) {
	db, err := sql.Open("sqlite", source.Connection)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var result []map[string]interface{}
	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, err
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]
			if val == nil {
				row[col] = nil
			} else {
				row[col] = val
			}
		}
		result = append(result, row)
	}

	return json.Marshal(result)
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
