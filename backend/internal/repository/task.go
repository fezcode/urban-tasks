package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"urban-tasks/internal/model"
)

// dateFrom converts a nullable pg date into *string (YYYY-MM-DD).
func dateFrom(d pgtype.Date) *string {
	if !d.Valid {
		return nil
	}
	s := d.Time.Format("2006-01-02")
	return &s
}

// dateTo converts an optional YYYY-MM-DD string into a pgtype.Date.
func dateTo(s *string) pgtype.Date {
	if s == nil || *s == "" {
		return pgtype.Date{Valid: false}
	}
	t, err := time.Parse("2006-01-02", *s)
	if err != nil {
		return pgtype.Date{Valid: false}
	}
	return pgtype.Date{Time: t, Valid: true}
}

type TaskRepo struct {
	pool *pgxpool.Pool
}

func NewTaskRepo(pool *pgxpool.Pool) *TaskRepo {
	return &TaskRepo{pool: pool}
}

const taskColumns = `t.id, t.user_id, t.project_id, t.title, t.body, t.status, t.priority, t.tags, t.links, t.subtasks, t.start_date, t.due_date, t.recurrence, t.position, t.created_at, t.updated_at, t.completed_at, t.created_by, t.updated_by`

func (r *TaskRepo) Create(ctx context.Context, t *model.Task) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO tasks (id, user_id, project_id, title, body, status, priority, tags, links, subtasks, start_date, due_date, recurrence, position, created_at, updated_at, completed_at, created_by, updated_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
		t.ID, t.UserID, t.ProjectID, t.Title, t.Body, t.Status, t.Priority, t.Tags, t.Links, t.Subtasks, dateTo(t.StartDate), dateTo(t.DueDate), t.Recurrence, t.Position, t.CreatedAt, t.UpdatedAt, t.CompletedAt, t.CreatedBy, t.UpdatedBy,
	)
	if err != nil {
		return fmt.Errorf("creating task: %w", err)
	}
	return nil
}

// ListByUser returns tasks across every project the user is a member of.
func (r *TaskRepo) ListByUser(ctx context.Context, userID string) ([]model.Task, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+taskColumns+`
		 FROM tasks t
		 JOIN project_members m ON m.project_id = t.project_id
		 WHERE m.user_id = $1
		 ORDER BY t.position, t.created_at DESC`, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing tasks: %w", err)
	}
	defer rows.Close()

	return scanTasks(rows)
}

// ListByProject returns tasks in a project the user is a member of.
func (r *TaskRepo) ListByProject(ctx context.Context, projectID, userID string) ([]model.Task, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+taskColumns+`
		 FROM tasks t
		 JOIN project_members m ON m.project_id = t.project_id
		 WHERE t.project_id = $1 AND m.user_id = $2
		 ORDER BY t.position, t.created_at DESC`,
		projectID, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing tasks by project: %w", err)
	}
	defer rows.Close()

	return scanTasks(rows)
}

// GetByID returns the task if the user is a member of its project.
func (r *TaskRepo) GetByID(ctx context.Context, id, userID string) (*model.Task, error) {
	t := &model.Task{}
	var start, due pgtype.Date
	err := r.pool.QueryRow(ctx,
		`SELECT `+taskColumns+`
		 FROM tasks t
		 JOIN project_members m ON m.project_id = t.project_id
		 WHERE t.id = $1 AND m.user_id = $2`, id, userID,
	).Scan(&t.ID, &t.UserID, &t.ProjectID, &t.Title, &t.Body, &t.Status, &t.Priority, &t.Tags, &t.Links, &t.Subtasks, &start, &due, &t.Recurrence, &t.Position, &t.CreatedAt, &t.UpdatedAt, &t.CompletedAt, &t.CreatedBy, &t.UpdatedBy)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting task: %w", err)
	}
	t.StartDate = dateFrom(start)
	t.DueDate = dateFrom(due)
	return t, nil
}

func (r *TaskRepo) Update(ctx context.Context, t *model.Task) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE tasks SET project_id = $1, title = $2, body = $3, status = $4, priority = $5, tags = $6, links = $7, subtasks = $8,
		 start_date = $9, due_date = $10, recurrence = $11, position = $12, updated_at = $13, completed_at = $14, updated_by = $15
		 WHERE id = $16`,
		t.ProjectID, t.Title, t.Body, t.Status, t.Priority, t.Tags, t.Links, t.Subtasks, dateTo(t.StartDate), dateTo(t.DueDate), t.Recurrence, t.Position, t.UpdatedAt, t.CompletedAt, t.UpdatedBy, t.ID,
	)
	if err != nil {
		return fmt.Errorf("updating task: %w", err)
	}
	return nil
}

func (r *TaskRepo) Delete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM tasks WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting task: %w", err)
	}
	return nil
}

func (r *TaskRepo) DeleteByProject(ctx context.Context, projectID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM tasks WHERE project_id = $1`, projectID)
	if err != nil {
		return fmt.Errorf("deleting tasks by project: %w", err)
	}
	return nil
}

// NextPosition is per-project (shared across members).
func (r *TaskRepo) NextPosition(ctx context.Context, projectID string) (int, error) {
	var pos *int
	err := r.pool.QueryRow(ctx,
		`SELECT MAX(position) FROM tasks WHERE project_id = $1`, projectID,
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
		var start, due pgtype.Date
		if err := rows.Scan(
			&t.ID, &t.UserID, &t.ProjectID, &t.Title, &t.Body, &t.Status, &t.Priority,
			&t.Tags, &t.Links, &t.Subtasks, &start, &due, &t.Recurrence, &t.Position, &t.CreatedAt, &t.UpdatedAt, &t.CompletedAt, &t.CreatedBy, &t.UpdatedBy,
		); err != nil {
			return nil, fmt.Errorf("scanning task: %w", err)
		}
		t.StartDate = dateFrom(start)
		t.DueDate = dateFrom(due)
		if t.Tags == nil {
			t.Tags = []string{}
		}
		if t.Links == nil {
			t.Links = []model.TaskLink{}
		}
		if t.Subtasks == nil {
			t.Subtasks = []model.Subtask{}
		}
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}
