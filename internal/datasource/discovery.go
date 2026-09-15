package datasource

import (
	"database/sql"
	"fmt"
	"strings"
)

// DiscoverTables scans a database and returns table names and their schemas
func DiscoverTables(dbType, connection string) ([]TableInfo, error) {
	db, err := connect(dbType, connection)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	var tables []TableInfo

	switch dbType {
	case "sqlite":
		tables, err = discoverSQLiteTables(db)
	case "postgres":
		tables, err = discoverPostgresTables(db)
	case "mysql":
		tables, err = discoverMySQLTables(db)
	default:
		return nil, fmt.Errorf("unsupported database type: %s", dbType)
	}

	return tables, err
}

type TableInfo struct {
	Name       string      `json:"name"`
	Columns    []ColumnInfo `json:"columns"`
	RowCount   int64       `json:"row_count,omitempty"`
}

type ColumnInfo struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Nullable bool  `json:"nullable"`
}

func discoverSQLiteTables(db *sql.DB) ([]TableInfo, error) {
	rows, err := db.Query(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []TableInfo
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			return nil, err
		}

		columns, err := getSQLiteColumns(db, tableName)
		if err != nil {
			continue
		}

		rowCount, _ := getSQLiteRowCount(db, tableName)

		tables = append(tables, TableInfo{
			Name:     tableName,
			Columns:  columns,
			RowCount: rowCount,
		})
	}
	return tables, nil
}

func getSQLiteColumns(db *sql.DB, tableName string) ([]ColumnInfo, error) {
	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s)", tableName))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var columns []ColumnInfo
	for rows.Next() {
		var col ColumnInfo
		var cid int
		var notnull int
		if err := rows.Scan(&cid, &col.Name, &col.Type, &notnull, nil, nil); err != nil {
			return nil, err
		}
		col.Nullable = notnull == 0
		columns = append(columns, col)
	}
	return columns, nil
}

func getSQLiteRowCount(db *sql.DB, tableName string) (int64, error) {
	var count int64
	err := db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM %s", tableName)).Scan(&count)
	return count, err
}

func discoverPostgresTables(db *sql.DB) ([]TableInfo, error) {
	rows, err := db.Query(`
		SELECT table_name 
		FROM information_schema.tables 
		WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
		ORDER BY table_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []TableInfo
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			return nil, err
		}

		columns, err := getPostgresColumns(db, tableName)
		if err != nil {
			continue
		}

		rowCount, _ := getPostgresRowCount(db, tableName)

		tables = append(tables, TableInfo{
			Name:     tableName,
			Columns:  columns,
			RowCount: rowCount,
		})
	}
	return tables, nil
}

func getPostgresColumns(db *sql.DB, tableName string) ([]ColumnInfo, error) {
	rows, err := db.Query(`
		SELECT column_name, data_type, is_nullable
		FROM information_schema.columns
		WHERE table_name = $1
		ORDER BY ordinal_position
	`, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var columns []ColumnInfo
	for rows.Next() {
		var col ColumnInfo
		var nullable string
		if err := rows.Scan(&col.Name, &col.Type, &nullable); err != nil {
			return nil, err
		}
		col.Nullable = nullable == "YES"
		columns = append(columns, col)
	}
	return columns, nil
}

func getPostgresRowCount(db *sql.DB, tableName string) (int64, error) {
	var count int64
	err := db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM %s", tableName)).Scan(&count)
	return count, err
}

func discoverMySQLTables(db *sql.DB) ([]TableInfo, error) {
	rows, err := db.Query(`
		SELECT table_name 
		FROM information_schema.tables 
		WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
		ORDER BY table_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []TableInfo
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			return nil, err
		}

		columns, err := getMySQLColumns(db, tableName)
		if err != nil {
			continue
		}

		rowCount, _ := getMySQLRowCount(db, tableName)

		tables = append(tables, TableInfo{
			Name:     tableName,
			Columns:  columns,
			RowCount: rowCount,
		})
	}
	return tables, nil
}

func getMySQLColumns(db *sql.DB, tableName string) ([]ColumnInfo, error) {
	rows, err := db.Query(fmt.Sprintf("SHOW COLUMNS FROM %s", tableName))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var columns []ColumnInfo
	for rows.Next() {
		var col ColumnInfo
		var extra string
		if err := rows.Scan(&col.Name, &col.Type, &extra, nil, nil, nil); err != nil {
			return nil, err
		}
		columns = append(columns, col)
	}
	return columns, nil
}

func getMySQLRowCount(db *sql.DB, tableName string) (int64, error) {
	var count int64
	err := db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM %s", tableName)).Scan(&count)
	return count, err
}

// GetSchema generates a text schema description for LLM context
func GetSchema(dbType, connection string) (string, error) {
	tables, err := DiscoverTables(dbType, connection)
	if err != nil {
		return "", err
	}

	var schema strings.Builder
	schema.WriteString(fmt.Sprintf("# Database Schema (%s)\n\n", dbType))

	for _, table := range tables {
		schema.WriteString(fmt.Sprintf("## Table: %s\n", table.Name))
		if table.RowCount > 0 {
			schema.WriteString(fmt.Sprintf("Rows: %d\n", table.RowCount))
		}
		schema.WriteString("Columns:\n")
		for _, col := range table.Columns {
			nullable := "NOT NULL"
			if col.Nullable {
				nullable = "NULL"
			}
			schema.WriteString(fmt.Sprintf("  - %s %s %s\n", col.Name, col.Type, nullable))
		}
		schema.WriteString("\n")
	}

	return schema.String(), nil
}
