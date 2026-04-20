package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"urban-tasks/internal/model"
)

type NotificationRepo struct {
	pool *pgxpool.Pool
}

func NewNotificationRepo(pool *pgxpool.Pool) *NotificationRepo {
	return &NotificationRepo{pool: pool}
}

func (r *NotificationRepo) Create(ctx context.Context, n *model.Notification) error {
	payload, err := json.Marshal(n.Payload)
	if err != nil {
		return fmt.Errorf("encoding payload: %w", err)
	}
	_, err = r.pool.Exec(ctx,
		`INSERT INTO notifications (id, user_id, kind, payload, created_at)
		 VALUES ($1,$2,$3,$4,$5)`,
		n.ID, n.UserID, n.Kind, payload, n.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("creating notification: %w", err)
	}
	return nil
}

func (r *NotificationRepo) ListByUser(ctx context.Context, userID string, limit int) ([]model.Notification, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, kind, payload, read_at, created_at
		 FROM notifications WHERE user_id = $1
		 ORDER BY created_at DESC LIMIT $2`, userID, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("listing notifications: %w", err)
	}
	defer rows.Close()

	var out []model.Notification
	for rows.Next() {
		var n model.Notification
		var payload []byte
		if err := rows.Scan(&n.ID, &n.UserID, &n.Kind, &payload, &n.ReadAt, &n.CreatedAt); err != nil {
			return nil, fmt.Errorf("scanning notification: %w", err)
		}
		if len(payload) > 0 {
			_ = json.Unmarshal(payload, &n.Payload)
		}
		if n.Payload == nil {
			n.Payload = map[string]any{}
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (r *NotificationRepo) UnreadCount(ctx context.Context, userID string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
		userID,
	).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("counting unread: %w", err)
	}
	return n, nil
}

func (r *NotificationRepo) MarkRead(ctx context.Context, id, userID string, at time.Time) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE notifications SET read_at = $1
		 WHERE id = $2 AND user_id = $3 AND read_at IS NULL`,
		at, id, userID,
	)
	if err != nil {
		return fmt.Errorf("marking read: %w", err)
	}
	return nil
}

func (r *NotificationRepo) MarkAllRead(ctx context.Context, userID string, at time.Time) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE notifications SET read_at = $1 WHERE user_id = $2 AND read_at IS NULL`,
		at, userID,
	)
	if err != nil {
		return fmt.Errorf("marking all read: %w", err)
	}
	return nil
}
