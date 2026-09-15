package datasource

import (
	"database/sql"
	"encoding/json"
	"fmt"
)

func GetSchemaByType(dbType, connection string) (string, error) {
	db, err := connect(dbType, connection)
	if err != nil {
		return "", err
	}
	defer db.Close()

	switch dbType {
	case "sqlite":
		return getSQLiteSchema(db)
	case "postgres":
		return getPostgresSchema(db)
	case "mysql":
		return getMySQLSchema(db)
	default:
		return "", fmt.Errorf("unsupported database type: %s", dbType)
	}
}

func ExecuteQueryByType(dbType, connection, query string) (json.RawMessage, error) {
	db, err := connect(dbType, connection)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	return executeQuery(db, query)
}

func connect(dbType, connection string) (*sql.DB, error) {
	switch dbType {
	case "sqlite":
		return sql.Open("sqlite", connection)
	case "postgres":
		return sql.Open("postgres", connection)
	case "mysql":
		return sql.Open("mysql", connection)
	default:
		return nil, fmt.Errorf("unsupported database type: %s", dbType)
	}
}

func getSQLiteSchema(db *sql.DB) (string, error) {
	var schema string
	rows, err := db.Query("SELECT name FROM sqlite_master WHERE type='table'")
	if err != nil {
		return "", err
	}
	defer rows.Close()

	for rows.Next() {
		var tableName string
		rows.Scan(&tableName)
		schema += fmt.Sprintf("Table: %s\n", tableName)

		colRows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s)", tableName))
		if err != nil {
			continue
		}
		for colRows.Next() {
			var cid int
			var columnName, colType string
			colRows.Scan(&cid, &columnName, &colType, nil, nil, nil)
			schema += fmt.Sprintf("  - %s %s\n", columnName, colType)
		}
		colRows.Close()
	}
	return schema, nil
}

func getPostgresSchema(db *sql.DB) (string, error) {
	var schema string
	rows, err := db.Query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
	if err != nil {
		return "", err
	}
	defer rows.Close()

	for rows.Next() {
		var tableName string
		rows.Scan(&tableName)
		schema += fmt.Sprintf("Table: %s\n", tableName)

		colRows, err := db.Query(fmt.Sprintf("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '%s'", tableName))
		if err != nil {
			continue
		}
		for colRows.Next() {
			var columnName, colType string
			colRows.Scan(&columnName, &colType)
			schema += fmt.Sprintf("  - %s %s\n", columnName, colType)
		}
		colRows.Close()
	}
	return schema, nil
}

func getMySQLSchema(db *sql.DB) (string, error) {
	var schema string
	rows, err := db.Query("SHOW TABLES")
	if err != nil {
		return "", err
	}
	defer rows.Close()

	for rows.Next() {
		var tableName string
		rows.Scan(&tableName)
		schema += fmt.Sprintf("Table: %s\n", tableName)

		colRows, err := db.Query(fmt.Sprintf("DESCRIBE %s", tableName))
		if err != nil {
			continue
		}
		for colRows.Next() {
			var fieldName, fieldType string
			colRows.Scan(&fieldName, &fieldType, nil, nil, nil)
			schema += fmt.Sprintf("  - %s %s\n", fieldName, fieldType)
		}
		colRows.Close()
	}
	return schema, nil
}

func executeQuery(db *sql.DB, query string) (json.RawMessage, error) {
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
