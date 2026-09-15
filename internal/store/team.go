package store

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"time"
)

func generateUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func generateToken(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

type TeamMember struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	TeamID     string    `json:"team_id"`
	Role       string    `json:"role"` // owner, admin, member
	InvitedAt  time.Time `json:"invited_at"`
	JoinedAt   time.Time `json:"joined_at"`
}

type Team struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	OwnerID     string    `json:"owner_id"`
	CreatedAt   time.Time `json:"created_at"`
}

type TeamInvite struct {
	ID        string    `json:"id"`
	TeamID    string    `json:"team_id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedBy string    `json:"created_by"`
	Used      bool      `json:"used"`
}

func (s *Store) CreateTeam(id, name, description, ownerID string) error {
	now := time.Now().Unix()
	_, err := s.db.Exec(
		"INSERT INTO teams (id, name, description, owner_id, created_at) VALUES (?, ?, ?, ?, ?)",
		id, name, description, ownerID, now,
	)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(
		"INSERT INTO team_members (user_id, team_id, role, invited_at, joined_at) VALUES (?, ?, ?, ?, ?)",
		ownerID, id, "owner", now, now,
	)
	return err
}

func (s *Store) GetTeam(id string) (*Team, error) {
	var t Team
	var createdAt int64
	err := s.db.QueryRow(
		"SELECT id, name, description, owner_id, created_at FROM teams WHERE id = ?",
		id,
	).Scan(&t.ID, &t.Name, &t.Description, &t.OwnerID, &createdAt)
	if err != nil {
		return nil, err
	}
	t.CreatedAt = time.Unix(createdAt, 0)
	return &t, nil
}

func (s *Store) GetUserTeams(userID string) ([]*Team, error) {
	rows, err := s.db.Query(
		`SELECT t.id, t.name, t.description, t.owner_id, t.created_at 
		 FROM teams t 
		 JOIN team_members tm ON t.id = tm.team_id 
		 WHERE tm.user_id = ?`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teams []*Team
	for rows.Next() {
		var t Team
		var createdAt int64
		if err := rows.Scan(&t.ID, &t.Name, &t.Description, &t.OwnerID, &createdAt); err != nil {
			return nil, err
		}
		t.CreatedAt = time.Unix(createdAt, 0)
		teams = append(teams, &t)
	}
	return teams, nil
}

func (s *Store) CreateInvite(teamID, email, role, createdBy string) (*TeamInvite, error) {
	id := generateUUID()
	token := generateToken(32)
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	_, err := s.db.Exec(
		"INSERT INTO team_invites (id, team_id, email, role, token, expires_at, created_by, used) VALUES (?, ?, ?, ?, ?, ?, ?, false)",
		id, teamID, email, role, token, expiresAt.Unix(), createdBy,
	)
	if err != nil {
		return nil, err
	}

	return &TeamInvite{
		ID:        id,
		TeamID:    teamID,
		Email:     email,
		Role:      role,
		Token:     token,
		ExpiresAt: expiresAt,
		CreatedBy: createdBy,
	}, nil
}

func (s *Store) RedeemInvite(token, userID string) error {
	var invite TeamInvite
	err := s.db.QueryRow(
		"SELECT id, team_id, email, role, expires_at, used FROM team_invites WHERE token = ?",
		token,
	).Scan(&invite.ID, &invite.TeamID, &invite.Email, &invite.Role, &invite.ExpiresAt, &invite.Used)
	if err != nil {
		return err
	}

	if invite.ExpiresAt.Before(time.Now()) {
		return sql.ErrNoRows
	}
	if invite.Used {
		return sql.ErrNoRows
	}

	now := time.Now().Unix()
	_, err = s.db.Exec(
		"INSERT INTO team_members (user_id, team_id, role, invited_at, joined_at) VALUES (?, ?, ?, ?, ?)",
		userID, invite.TeamID, invite.Role, now, now,
	)
	if err != nil {
		return err
	}

	return s.db.Exec(
		"UPDATE team_invites SET used = true WHERE token = ?",
		token,
	)
}

func (s *Store) GetTeamMembers(teamID string) ([]*TeamMember, error) {
	rows, err := s.db.Query(
		`SELECT tm.user_id, tm.team_id, tm.role, tm.invited_at, tm.joined_at 
		 FROM team_members tm 
		 WHERE tm.team_id = ?`,
		teamID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []*TeamMember
	for rows.Next() {
		var m TeamMember
		var invitedAt, joinedAt int64
		if err := rows.Scan(&m.UserID, &m.TeamID, &m.Role, &invitedAt, &joinedAt); err != nil {
			return nil, err
		}
		m.InvitedAt = time.Unix(invitedAt, 0)
		m.JoinedAt = time.Unix(joinedAt, 0)
		members = append(members, &m)
	}
	return members, nil
}

func (s *Store) RemoveMember(teamID, userID string) error {
	_, err := s.db.Exec(
		"DELETE FROM team_members WHERE team_id = ? AND user_id = ?",
		teamID, userID,
	)
	return err
}

func (s *Store) UpdateMemberRole(teamID, userID, role string) error {
	_, err := s.db.Exec(
		"UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?",
		role, teamID, userID,
	)
	return err
}

func (s *Store) IsTeamMember(teamID, userID string) (bool, error) {
	var count int
	err := s.db.QueryRow(
		"SELECT COUNT(*) FROM team_members WHERE team_id = ? AND user_id = ?",
		teamID, userID,
	).Scan(&count)
	return count > 0, err
}

func (s *Store) GetUserRole(teamID, userID string) (string, error) {
	var role string
	err := s.db.QueryRow(
		"SELECT role FROM team_members WHERE team_id = ? AND user_id = ?",
		teamID, userID,
	).Scan(&role)
	return role, err
}
