package store

import (
	"time"

	_ "modernc.org/sqlite"
)

type ShareLink struct {
	ID        string    `json:"id"`
	ReportID  string    `json:"report_id"`
	Token     string    `json:"token"`
	UserID    string    `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *Store) CreateShareLink(reportID, token, userID string) error {
	_, err := s.db.Exec(
		"INSERT OR REPLACE INTO share_links (id, report_id, token, user_id, created_at) VALUES (?, ?, ?, ?, ?)",
		token, reportID, token, userID, time.Now().Unix(),
	)
	return err
}

func (s *Store) GetShareLink(token string) (*ShareLink, error) {
	var sl ShareLink
	var createdAt int64
	err := s.db.QueryRow(
		"SELECT id, report_id, token, user_id, created_at FROM share_links WHERE token = ?",
		token,
	).Scan(&sl.ID, &sl.ReportID, &sl.Token, &sl.UserID, &createdAt)
	if err != nil {
		return nil, err
	}
	sl.CreatedAt = time.Unix(createdAt, 0)
	return &sl, nil
}
