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

func (r *ProjectRepo) Create(ctx context.Context, p *model.Project) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO projects (id, user_id, name, color, icon_seed, position, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		p.ID, p.UserID, p.Name, p.Color, p.IconSeed, p.Position, p.CreatedAt, p.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("creating project: %w", err)
	}
	return nil
}

func (r *ProjectRepo) ListByUser(ctx context.Context, userID string) ([]model.Project, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, name, color, icon_seed, position, created_at, updated_at
		 FROM projects WHERE user_id = $1 ORDER BY position, created_at`, userID,
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

func (r *ProjectRepo) GetByID(ctx context.Context, id, userID string) (*model.Project, error) {
	p := &model.Project{}
	err := r.pool.QueryRow(ctx,
		`SELECT id, user_id, name, color, icon_seed, position, created_at, updated_at
		 FROM projects WHERE id = $1 AND user_id = $2`, id, userID,
	).Scan(&p.ID, &p.UserID, &p.Name, &p.Color, &p.IconSeed, &p.Position, &p.CreatedAt, &p.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting project: %w", err)
	}
	return p, nil
}

func (r *ProjectRepo) Update(ctx context.Context, p *model.Project) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE projects SET name = $1, color = $2, icon_seed = $3, position = $4, updated_at = $5
		 WHERE id = $6 AND user_id = $7`,
		p.Name, p.Color, p.IconSeed, p.Position, p.UpdatedAt, p.ID, p.UserID,
	)
	if err != nil {
		return fmt.Errorf("updating project: %w", err)
	}
	return nil
}

func (r *ProjectRepo) Delete(ctx context.Context, id, userID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM projects WHERE id = $1 AND user_id = $2`, id, userID,
	)
	if err != nil {
		return fmt.Errorf("deleting project: %w", err)
	}
	return nil
}

func (r *ProjectRepo) NextPosition(ctx context.Context, userID string) (int, error) {
	var pos *int
	err := r.pool.QueryRow(ctx,
		`SELECT MAX(position) FROM projects WHERE user_id = $1`, userID,
	).Scan(&pos)
	if err != nil {
		return 0, fmt.Errorf("getting next position: %w", err)
	}
	if pos == nil {
		return 0, nil
	}
	return *pos + 1, nil
}
