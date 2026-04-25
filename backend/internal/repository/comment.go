package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"urban-tasks/internal/model"
)

type CommentRepo struct {
	pool *pgxpool.Pool
}

func NewCommentRepo(pool *pgxpool.Pool) *CommentRepo {
	return &CommentRepo{pool: pool}
}

const commentSelect = `
SELECT c.id, c.task_id, c.user_id, COALESCE(u.name, ''), u.avatar_seed,
       c.body, c.mentions, c.edited_at, c.created_at
FROM task_comments c
LEFT JOIN users u ON u.id = c.user_id
`

func (r *CommentRepo) ListByTask(ctx context.Context, taskID string) ([]model.TaskComment, error) {
	rows, err := r.pool.Query(ctx,
		commentSelect+` WHERE c.task_id = $1 ORDER BY c.created_at`, taskID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing comments: %w", err)
	}
	defer rows.Close()

	var out []model.TaskComment
	for rows.Next() {
		c, err := scanComment(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if out == nil {
		out = []model.TaskComment{}
	}
	return out, rows.Err()
}

func (r *CommentRepo) GetByID(ctx context.Context, id string) (*model.TaskComment, error) {
	row := r.pool.QueryRow(ctx, commentSelect+` WHERE c.id = $1`, id)
	c, err := scanComment(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *CommentRepo) Create(ctx context.Context, c *model.TaskComment) error {
	mentions, err := json.Marshal(c.Mentions)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx,
		`INSERT INTO task_comments (id, task_id, user_id, body, mentions, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		c.ID, c.TaskID, c.UserID, c.Body, mentions, c.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("creating comment: %w", err)
	}
	return nil
}

func (r *CommentRepo) Update(ctx context.Context, c *model.TaskComment) error {
	mentions, err := json.Marshal(c.Mentions)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx,
		`UPDATE task_comments SET body=$1, mentions=$2, edited_at=$3 WHERE id=$4`,
		c.Body, mentions, c.EditedAt, c.ID,
	)
	return err
}

func (r *CommentRepo) Delete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM task_comments WHERE id=$1`, id)
	return err
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanComment(s rowScanner) (model.TaskComment, error) {
	var c model.TaskComment
	var raw []byte
	if err := s.Scan(
		&c.ID, &c.TaskID, &c.UserID, &c.AuthorName, &c.AuthorSeed,
		&c.Body, &raw, &c.EditedAt, &c.CreatedAt,
	); err != nil {
		return c, err
	}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &c.Mentions)
	}
	if c.Mentions == nil {
		c.Mentions = []string{}
	}
	return c, nil
}
