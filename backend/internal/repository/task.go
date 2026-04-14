package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"urban-tasks/internal/model"
)

type TaskRepo struct {
	pool *pgxpool.Pool
}

func NewTaskRepo(pool *pgxpool.Pool) *TaskRepo {
	return &TaskRepo{pool: pool}
}

func (r *TaskRepo) Create(ctx context.Context, t *model.Task) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO tasks (id, user_id, project_id, title, body, status, priority, tags, due_date, position, created_at, updated_at, completed_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
		t.ID, t.UserID, t.ProjectID, t.Title, t.Body, t.Status, t.Priority, t.Tags, t.DueDate, t.Position, t.CreatedAt, t.UpdatedAt, t.CompletedAt,
	)
	if err != nil {
		return fmt.Errorf("creating task: %w", err)
	}
	return nil
}

func (r *TaskRepo) ListByUser(ctx context.Context, userID string) ([]model.Task, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, project_id, title, body, status, priority, tags, due_date, position, created_at, updated_at, completed_at
		 FROM tasks WHERE user_id = $1 ORDER BY position, created_at DESC`, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing tasks: %w", err)
	}
	defer rows.Close()

	return scanTasks(rows)
}

func (r *TaskRepo) ListByProject(ctx context.Context, projectID, userID string) ([]model.Task, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, project_id, title, body, status, priority, tags, due_date, position, created_at, updated_at, completed_at
		 FROM tasks WHERE project_id = $1 AND user_id = $2 ORDER BY position, created_at DESC`,
		projectID, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing tasks by project: %w", err)
	}
	defer rows.Close()

	return scanTasks(rows)
}

func (r *TaskRepo) GetByID(ctx context.Context, id, userID string) (*model.Task, error) {
	t := &model.Task{}
	err := r.pool.QueryRow(ctx,
		`SELECT id, user_id, project_id, title, body, status, priority, tags, due_date, position, created_at, updated_at, completed_at
		 FROM tasks WHERE id = $1 AND user_id = $2`, id, userID,
	).Scan(&t.ID, &t.UserID, &t.ProjectID, &t.Title, &t.Body, &t.Status, &t.Priority, &t.Tags, &t.DueDate, &t.Position, &t.CreatedAt, &t.UpdatedAt, &t.CompletedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting task: %w", err)
	}
	return t, nil
}

func (r *TaskRepo) Update(ctx context.Context, t *model.Task) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE tasks SET project_id = $1, title = $2, body = $3, status = $4, priority = $5, tags = $6,
		 due_date = $7, position = $8, updated_at = $9, completed_at = $10
		 WHERE id = $11 AND user_id = $12`,
		t.ProjectID, t.Title, t.Body, t.Status, t.Priority, t.Tags, t.DueDate, t.Position, t.UpdatedAt, t.CompletedAt, t.ID, t.UserID,
	)
	if err != nil {
		return fmt.Errorf("updating task: %w", err)
	}
	return nil
}

func (r *TaskRepo) Delete(ctx context.Context, id, userID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM tasks WHERE id = $1 AND user_id = $2`, id, userID,
	)
	if err != nil {
		return fmt.Errorf("deleting task: %w", err)
	}
	return nil
}

func (r *TaskRepo) DeleteByProject(ctx context.Context, projectID, userID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM tasks WHERE project_id = $1 AND user_id = $2`, projectID, userID,
	)
	if err != nil {
		return fmt.Errorf("deleting tasks by project: %w", err)
	}
	return nil
}

func (r *TaskRepo) NextPosition(ctx context.Context, projectID, userID string) (int, error) {
	var pos *int
	err := r.pool.QueryRow(ctx,
		`SELECT MAX(position) FROM tasks WHERE project_id = $1 AND user_id = $2`, projectID, userID,
	).Scan(&pos)
	if err != nil {
		return 0, fmt.Errorf("getting next position: %w", err)
	}
	if pos == nil {
		return 0, nil
	}
	return *pos + 1, nil
}

func scanTasks(rows pgx.Rows) ([]model.Task, error) {
	var tasks []model.Task
	for rows.Next() {
		var t model.Task
		if err := rows.Scan(
			&t.ID, &t.UserID, &t.ProjectID, &t.Title, &t.Body, &t.Status, &t.Priority,
			&t.Tags, &t.DueDate, &t.Position, &t.CreatedAt, &t.UpdatedAt, &t.CompletedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning task: %w", err)
		}
		if t.Tags == nil {
			t.Tags = []string{}
		}
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}
