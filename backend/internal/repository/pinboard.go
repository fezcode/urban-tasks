package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"urban-tasks/internal/model"
)

type PinboardRepo struct {
	pool *pgxpool.Pool
}

func NewPinboardRepo(pool *pgxpool.Pool) *PinboardRepo {
	return &PinboardRepo{pool: pool}
}

func (r *PinboardRepo) ListCards(ctx context.Context, projectID string) ([]model.PinboardCard, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, project_id, task_id, x, y, created_at
		 FROM pinboard_cards WHERE project_id = $1 ORDER BY created_at`, projectID)
	if err != nil {
		return nil, fmt.Errorf("listing cards: %w", err)
	}
	defer rows.Close()

	var out []model.PinboardCard
	for rows.Next() {
		var c model.PinboardCard
		if err := rows.Scan(&c.ID, &c.ProjectID, &c.TaskID, &c.X, &c.Y, &c.CreatedAt); err != nil {
			return nil, fmt.Errorf("scanning card: %w", err)
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *PinboardRepo) ListConnections(ctx context.Context, projectID string) ([]model.PinboardConnection, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, project_id, a_task_id, b_task_id, label, created_at
		 FROM pinboard_connections WHERE project_id = $1 ORDER BY created_at`, projectID)
	if err != nil {
		return nil, fmt.Errorf("listing connections: %w", err)
	}
	defer rows.Close()

	var out []model.PinboardConnection
	for rows.Next() {
		var c model.PinboardConnection
		if err := rows.Scan(&c.ID, &c.ProjectID, &c.ATaskID, &c.BTaskID, &c.Label, &c.CreatedAt); err != nil {
			return nil, fmt.Errorf("scanning connection: %w", err)
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// CardByID returns a card only if the user is a member of its project.
func (r *PinboardRepo) CardByID(ctx context.Context, id, userID string) (*model.PinboardCard, error) {
	c := &model.PinboardCard{}
	err := r.pool.QueryRow(ctx,
		`SELECT pc.id, pc.project_id, pc.task_id, pc.x, pc.y, pc.created_at
		 FROM pinboard_cards pc
		 JOIN project_members m ON m.project_id = pc.project_id
		 WHERE pc.id = $1 AND m.user_id = $2`, id, userID).
		Scan(&c.ID, &c.ProjectID, &c.TaskID, &c.X, &c.Y, &c.CreatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting card: %w", err)
	}
	return c, nil
}

func (r *PinboardRepo) CreateCard(ctx context.Context, c *model.PinboardCard) error {
	err := r.pool.QueryRow(ctx,
		`INSERT INTO pinboard_cards (project_id, task_id, x, y)
		 VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
		c.ProjectID, c.TaskID, c.X, c.Y).Scan(&c.ID, &c.CreatedAt)
	if err != nil {
		return fmt.Errorf("creating card: %w", err)
	}
	return nil
}

func (r *PinboardRepo) UpdateCardPos(ctx context.Context, id string, x, y float64) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE pinboard_cards SET x = $1, y = $2 WHERE id = $3`, x, y, id)
	if err != nil {
		return fmt.Errorf("updating card position: %w", err)
	}
	return nil
}

func (r *PinboardRepo) DeleteCard(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM pinboard_cards WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting card: %w", err)
	}
	return nil
}

func (r *PinboardRepo) IsTaskPinned(ctx context.Context, projectID, taskID string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM pinboard_cards WHERE project_id = $1 AND task_id = $2)`,
		projectID, taskID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("checking pinned: %w", err)
	}
	return exists, nil
}

// DeleteConnectionsForTask removes any string touching a task (used on unpin).
func (r *PinboardRepo) DeleteConnectionsForTask(ctx context.Context, projectID, taskID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM pinboard_connections
		 WHERE project_id = $1 AND $2 IN (a_task_id, b_task_id)`, projectID, taskID)
	if err != nil {
		return fmt.Errorf("deleting connections for task: %w", err)
	}
	return nil
}

func (r *PinboardRepo) ConnectionByID(ctx context.Context, id, userID string) (*model.PinboardConnection, error) {
	c := &model.PinboardConnection{}
	err := r.pool.QueryRow(ctx,
		`SELECT pc.id, pc.project_id, pc.a_task_id, pc.b_task_id, pc.label, pc.created_at
		 FROM pinboard_connections pc
		 JOIN project_members m ON m.project_id = pc.project_id
		 WHERE pc.id = $1 AND m.user_id = $2`, id, userID).
		Scan(&c.ID, &c.ProjectID, &c.ATaskID, &c.BTaskID, &c.Label, &c.CreatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting connection: %w", err)
	}
	return c, nil
}

// CreateConnection inserts the string; reconnecting an existing pair just updates its label.
func (r *PinboardRepo) CreateConnection(ctx context.Context, c *model.PinboardConnection) error {
	err := r.pool.QueryRow(ctx,
		`INSERT INTO pinboard_connections (project_id, a_task_id, b_task_id, label)
		 VALUES ($1,$2,$3,$4)
		 ON CONFLICT (project_id, a_task_id, b_task_id)
		 DO UPDATE SET label = EXCLUDED.label
		 RETURNING id, created_at`,
		c.ProjectID, c.ATaskID, c.BTaskID, c.Label).Scan(&c.ID, &c.CreatedAt)
	if err != nil {
		return fmt.Errorf("creating connection: %w", err)
	}
	return nil
}

func (r *PinboardRepo) UpdateConnectionLabel(ctx context.Context, id, label string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE pinboard_connections SET label = $1 WHERE id = $2`, label, id)
	if err != nil {
		return fmt.Errorf("updating connection label: %w", err)
	}
	return nil
}

func (r *PinboardRepo) DeleteConnection(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM pinboard_connections WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting connection: %w", err)
	}
	return nil
}
