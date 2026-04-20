package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"urban-tasks/internal/model"
)

type ProjectRepo struct {
	pool *pgxpool.Pool
}

func NewProjectRepo(pool *pgxpool.Pool) *ProjectRepo {
	return &ProjectRepo{pool: pool}
}

// Create inserts the project AND makes the creator an admin member in one tx.
func (r *ProjectRepo) Create(ctx context.Context, p *model.Project) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`INSERT INTO projects (id, user_id, name, color, icon_seed, position, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		p.ID, p.UserID, p.Name, p.Color, p.IconSeed, p.Position, p.CreatedAt, p.UpdatedAt,
	); err != nil {
		return fmt.Errorf("creating project: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO project_members (project_id, user_id, role, joined_at)
		 VALUES ($1, $2, 'admin', $3)`,
		p.ID, p.UserID, p.CreatedAt,
	); err != nil {
		return fmt.Errorf("adding creator as admin: %w", err)
	}

	return tx.Commit(ctx)
}

// ListByUser returns every project the user is a member of, ordered by position.
func (r *ProjectRepo) ListByUser(ctx context.Context, userID string) ([]model.Project, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT p.id, p.user_id, p.name, p.color, p.icon_seed, p.position, p.created_at, p.updated_at
		 FROM projects p
		 JOIN project_members m ON m.project_id = p.id
		 WHERE m.user_id = $1
		 ORDER BY p.position, p.created_at`, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing projects: %w", err)
	}
	defer rows.Close()

	var projects []model.Project
	for rows.Next() {
		var p model.Project
		if err := rows.Scan(&p.ID, &p.UserID, &p.Name, &p.Color, &p.IconSeed, &p.Position, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning project: %w", err)
		}
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

// GetByID returns the project if the user is a member.
func (r *ProjectRepo) GetByID(ctx context.Context, id, userID string) (*model.Project, error) {
	p := &model.Project{}
	err := r.pool.QueryRow(ctx,
		`SELECT p.id, p.user_id, p.name, p.color, p.icon_seed, p.position, p.created_at, p.updated_at
		 FROM projects p
		 JOIN project_members m ON m.project_id = p.id
		 WHERE p.id = $1 AND m.user_id = $2`, id, userID,
	).Scan(&p.ID, &p.UserID, &p.Name, &p.Color, &p.IconSeed, &p.Position, &p.CreatedAt, &p.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting project: %w", err)
	}
	return p, nil
}

// GetRole returns the user's role in a project, or "" if not a member.
func (r *ProjectRepo) GetRole(ctx context.Context, projectID, userID string) (string, error) {
	var role string
	err := r.pool.QueryRow(ctx,
		`SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
		projectID, userID,
	).Scan(&role)
	if err == pgx.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("getting role: %w", err)
	}
	return role, nil
}

// Update writes any field changes. Membership/role checks happen in service layer.
func (r *ProjectRepo) Update(ctx context.Context, p *model.Project) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE projects SET name = $1, color = $2, icon_seed = $3, position = $4, updated_at = $5
		 WHERE id = $6`,
		p.Name, p.Color, p.IconSeed, p.Position, p.UpdatedAt, p.ID,
	)
	if err != nil {
		return fmt.Errorf("updating project: %w", err)
	}
	return nil
}

// Delete removes the project (ON DELETE CASCADE handles members/tasks).
func (r *ProjectRepo) Delete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM projects WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting project: %w", err)
	}
	return nil
}

// NextPosition returns the next position across projects the user can see.
func (r *ProjectRepo) NextPosition(ctx context.Context, userID string) (int, error) {
	var pos *int
	err := r.pool.QueryRow(ctx,
		`SELECT MAX(p.position)
		 FROM projects p
		 JOIN project_members m ON m.project_id = p.id
		 WHERE m.user_id = $1`, userID,
	).Scan(&pos)
	if err != nil {
		return 0, fmt.Errorf("getting next position: %w", err)
	}
	if pos == nil {
		return 0, nil
	}
	return *pos + 1, nil
}

// --- members ---

func (r *ProjectRepo) ListMembers(ctx context.Context, projectID string) ([]model.ProjectMember, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT m.project_id, m.user_id, m.role, u.name, u.email, u.avatar_seed, m.joined_at
		 FROM project_members m
		 JOIN users u ON u.id = m.user_id
		 WHERE m.project_id = $1
		 ORDER BY m.joined_at`, projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing members: %w", err)
	}
	defer rows.Close()

	var out []model.ProjectMember
	for rows.Next() {
		var m model.ProjectMember
		if err := rows.Scan(&m.ProjectID, &m.UserID, &m.Role, &m.Name, &m.Email, &m.AvatarSeed, &m.JoinedAt); err != nil {
			return nil, fmt.Errorf("scanning member: %w", err)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *ProjectRepo) AddMember(ctx context.Context, projectID, userID, role string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)
		 ON CONFLICT (project_id, user_id) DO NOTHING`,
		projectID, userID, role,
	)
	if err != nil {
		return fmt.Errorf("adding member: %w", err)
	}
	return nil
}

func (r *ProjectRepo) RemoveMember(ctx context.Context, projectID, userID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
		projectID, userID,
	)
	if err != nil {
		return fmt.Errorf("removing member: %w", err)
	}
	return nil
}

func (r *ProjectRepo) AdminCount(ctx context.Context, projectID string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM project_members WHERE project_id = $1 AND role = 'admin'`,
		projectID,
	).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("counting admins: %w", err)
	}
	return n, nil
}
