package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"urban-tasks/internal/model"
)

type InvitationRepo struct {
	pool *pgxpool.Pool
}

func NewInvitationRepo(pool *pgxpool.Pool) *InvitationRepo {
	return &InvitationRepo{pool: pool}
}

const invitationJoin = `
SELECT i.id, i.project_id, p.name, p.color, i.inviter_id, u.name, i.invitee_email, i.invitee_id,
       i.status, i.expires_at, i.created_at, i.responded_at
FROM invitations i
JOIN projects p ON p.id = i.project_id
JOIN users u ON u.id = i.inviter_id`

func scanInvitation(row pgx.Row) (*model.Invitation, error) {
	inv := &model.Invitation{}
	err := row.Scan(&inv.ID, &inv.ProjectID, &inv.ProjectName, &inv.ProjectColor,
		&inv.InviterID, &inv.InviterName, &inv.InviteeEmail, &inv.InviteeID,
		&inv.Status, &inv.ExpiresAt, &inv.CreatedAt, &inv.RespondedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return inv, nil
}

func scanInvitations(rows pgx.Rows) ([]model.Invitation, error) {
	var out []model.Invitation
	for rows.Next() {
		var inv model.Invitation
		if err := rows.Scan(&inv.ID, &inv.ProjectID, &inv.ProjectName, &inv.ProjectColor,
			&inv.InviterID, &inv.InviterName, &inv.InviteeEmail, &inv.InviteeID,
			&inv.Status, &inv.ExpiresAt, &inv.CreatedAt, &inv.RespondedAt); err != nil {
			return nil, fmt.Errorf("scan invitation: %w", err)
		}
		out = append(out, inv)
	}
	return out, rows.Err()
}

func (r *InvitationRepo) Create(ctx context.Context, inv *model.Invitation) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO invitations (id, project_id, inviter_id, invitee_email, invitee_id, status, expires_at, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		inv.ID, inv.ProjectID, inv.InviterID, strings.ToLower(inv.InviteeEmail), inv.InviteeID,
		inv.Status, inv.ExpiresAt, inv.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("creating invitation: %w", err)
	}
	return nil
}

func (r *InvitationRepo) GetByID(ctx context.Context, id string) (*model.Invitation, error) {
	row := r.pool.QueryRow(ctx, invitationJoin+` WHERE i.id = $1`, id)
	return scanInvitation(row)
}

// ListForUser returns pending, non-expired invitations for this user
// (matched by invitee_id OR by email).
func (r *InvitationRepo) ListForUser(ctx context.Context, userID, email string) ([]model.Invitation, error) {
	rows, err := r.pool.Query(ctx,
		invitationJoin+`
		 WHERE i.status = 'pending'
		   AND i.expires_at > NOW()
		   AND (i.invitee_id = $1 OR LOWER(i.invitee_email) = LOWER($2))
		 ORDER BY i.created_at DESC`,
		userID, email,
	)
	if err != nil {
		return nil, fmt.Errorf("listing invitations: %w", err)
	}
	defer rows.Close()
	return scanInvitations(rows)
}

// ListForProject returns invitations on a project (any status), newest first.
func (r *InvitationRepo) ListForProject(ctx context.Context, projectID string) ([]model.Invitation, error) {
	rows, err := r.pool.Query(ctx,
		invitationJoin+` WHERE i.project_id = $1 ORDER BY i.created_at DESC`,
		projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing project invitations: %w", err)
	}
	defer rows.Close()
	return scanInvitations(rows)
}

func (r *InvitationRepo) Respond(ctx context.Context, id, status string, at time.Time) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE invitations SET status = $1, responded_at = $2 WHERE id = $3 AND status = 'pending'`,
		status, at, id,
	)
	if err != nil {
		return fmt.Errorf("responding to invitation: %w", err)
	}
	return nil
}

// AttachInviteeID backfills invitee_id once an invited email registers.
func (r *InvitationRepo) AttachInviteeID(ctx context.Context, email, userID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE invitations SET invitee_id = $1
		 WHERE invitee_id IS NULL AND LOWER(invitee_email) = LOWER($2)`,
		userID, email,
	)
	if err != nil {
		return fmt.Errorf("attaching invitee id: %w", err)
	}
	return nil
}

// HasPending returns true if there's already a pending invitation for this email on this project.
func (r *InvitationRepo) HasPending(ctx context.Context, projectID, email string) (bool, error) {
	var n int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM invitations
		 WHERE project_id = $1 AND LOWER(invitee_email) = LOWER($2)
		   AND status = 'pending' AND expires_at > NOW()`,
		projectID, email,
	).Scan(&n)
	if err != nil {
		return false, fmt.Errorf("checking pending: %w", err)
	}
	return n > 0, nil
}
