package store

import (
	"database/sql"
	"time"

	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

type User struct {
	ID        string
	Email     string
	Password  string
	CreatedAt time.Time
	IsPro     bool
	QueryCount int
}

type DataSource struct {
	ID         string
	UserID     string
	Name       string
	Type       string // sqlite, postgres, mysql
	Connection string
	CreatedAt  time.Time
}

type Report struct {
	ID          string
	UserID      string
	Title       string
	SQL         string
	ChartType   string
	Query       string
	Result      string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func NewDB(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}

	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		email TEXT UNIQUE,
		password TEXT,
		created_at INTEGER NOT NULL,
		is_pro INTEGER DEFAULT 0,
		query_count INTEGER DEFAULT 0
	);
	
	CREATE TABLE IF NOT EXISTS data_sources (
		id TEXT PRIMARY KEY,
		user_id TEXT,
		name TEXT,
		type TEXT,
		connection TEXT,
		created_at INTEGER NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id)
	);
	
	CREATE TABLE IF NOT EXISTS reports (
		id TEXT PRIMARY KEY,
		user_id TEXT,
		title TEXT,
		sql_query TEXT,
		natural_query TEXT,
		chart_type TEXT,
		result TEXT,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id)
	);
	`

	_, err = db.Exec(schema)
	if err != nil {
		return nil, err
	}

	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) CreateUser(id, email, password string) error {
	now := time.Now().Unix()
	_, err := s.db.Exec(
		"INSERT INTO users (id, email, password, created_at) VALUES (?, ?, ?, ?)",
		id, email, password, now,
	)
	return err
}

func (s *Store) GetUserByEmail(email string) (*User, error) {
	var u User
	var createdAt int64
	err := s.db.QueryRow(
		"SELECT id, email, password, created_at, is_pro, query_count FROM users WHERE email = ?",
		email,
	).Scan(&u.ID, &u.Email, &u.Password, &createdAt, &u.IsPro, &u.QueryCount)
	if err != nil {
		return nil, err
	}
	u.CreatedAt = time.Unix(createdAt, 0)
	return &u, nil
}

func (s *Store) GetUserByID(id string) (*User, error) {
	var u User
	var createdAt int64
	err := s.db.QueryRow(
		"SELECT id, email, password, created_at, is_pro, query_count FROM users WHERE id = ?",
		id,
	).Scan(&u.ID, &u.Email, &u.Password, &createdAt, &u.IsPro, &u.QueryCount)
	if err != nil {
		return nil, err
	}
	u.CreatedAt = time.Unix(createdAt, 0)
	return &u, nil
}

func (s *Store) UpdateUserQueryCount(id string, count int) error {
	_, err := s.db.Exec(
		"UPDATE users SET query_count = query_count + ? WHERE id = ?",
		count, id,
	)
	return err
}

func (s *Store) SetUserPro(userID string, isPro bool) error {
	_, err := s.db.Exec("UPDATE users SET is_pro = ? WHERE id = ?", isPro, userID)
	return err
}

func (s *Store) CreateDataSource(id, userID, name, dtype, connection string) error {
	now := time.Now().Unix()
	_, err := s.db.Exec(
		"INSERT INTO data_sources (id, user_id, name, type, connection, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		id, userID, name, dtype, connection, now,
	)
	return err
}

func (s *Store) GetDataSources(userID string) ([]*DataSource, error) {
	rows, err := s.db.Query(
		"SELECT id, user_id, name, type, connection, created_at FROM data_sources WHERE user_id = ?",
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sources []*DataSource
	for rows.Next() {
		var d DataSource
		var createdAt int64
		if err := rows.Scan(&d.ID, &d.UserID, &d.Name, &d.Type, &d.Connection, &createdAt); err != nil {
			return nil, err
		}
		d.CreatedAt = time.Unix(createdAt, 0)
		sources = append(sources, &d)
	}
	return sources, nil
}

func (s *Store) CreateReport(id, userID, title, sqlQuery, naturalQuery, chartType, result string) error {
	now := time.Now().Unix()
	_, err := s.db.Exec(
		"INSERT INTO reports (id, user_id, title, sql_query, natural_query, chart_type, result, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		id, userID, title, sqlQuery, naturalQuery, chartType, result, now, now,
	)
	return err
}

func (s *Store) GetReports(userID string) ([]*Report, error) {
	rows, err := s.db.Query(
		"SELECT id, user_id, title, sql_query, natural_query, chart_type, result, created_at, updated_at FROM reports WHERE user_id = ? ORDER BY created_at DESC",
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []*Report
	for rows.Next() {
		var r Report
		var createdAt, updatedAt int64
		if err := rows.Scan(&r.ID, &r.UserID, &r.Title, &r.SQL, &r.Query, &r.ChartType, &r.Result, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		r.CreatedAt = time.Unix(createdAt, 0)
		r.UpdatedAt = time.Unix(updatedAt, 0)
		reports = append(reports, &r)
	}
	return reports, nil
}
