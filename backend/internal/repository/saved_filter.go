package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"urban-tasks/internal/model"
)

type SavedFilterRepo struct {
	pool *pgxpool.Pool
}

func NewSavedFilterRepo(pool *pgxpool.Pool) *SavedFilterRepo {
	return &SavedFilterRepo{pool: pool}
}

const savedFilterCols = `id, user_id, name, icon, filter, position, created_at, updated_at`

func (r *SavedFilterRepo) ListByUser(ctx context.Context, userID string) ([]model.SavedFilter, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+savedFilterCols+` FROM saved_filters WHERE user_id = $1 ORDER BY position, created_at`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing saved filters: %w", err)
	}
	defer rows.Close()

	var out []model.SavedFilter
	for rows.Next() {
		f, err := scanSavedFilter(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	if out == nil {
		out = []model.SavedFilter{}
	}
	return out, rows.Err()
}

func (r *SavedFilterRepo) GetByID(ctx context.Context, id, userID string) (*model.SavedFilter, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT `+savedFilterCols+` FROM saved_filters WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	f, err := scanSavedFilter(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *SavedFilterRepo) Create(ctx context.Context, f *model.SavedFilter) error {
	payload, err := json.Marshal(f.Filter)
	if err != nil {
		return fmt.Errorf("encoding filter: %w", err)
	}
	_, err = r.pool.Exec(ctx,
		`INSERT INTO saved_filters (id, user_id, name, icon, filter, position, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		f.ID, f.UserID, f.Name, f.Icon, payload, f.Position, f.CreatedAt, f.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("creating saved filter: %w", err)
	}
	return nil
}

func (r *SavedFilterRepo) Update(ctx context.Context, f *model.SavedFilter) error {
	payload, err := json.Marshal(f.Filter)
	if err != nil {
		return fmt.Errorf("encoding filter: %w", err)
	}
	_, err = r.pool.Exec(ctx,
		`UPDATE saved_filters SET name=$1, icon=$2, filter=$3, position=$4, updated_at=$5
		 WHERE id=$6 AND user_id=$7`,
		f.Name, f.Icon, payload, f.Position, f.UpdatedAt, f.ID, f.UserID,
	)
	if err != nil {
		return fmt.Errorf("updating saved filter: %w", err)
	}
	return nil
}

func (r *SavedFilterRepo) Delete(ctx context.Context, id, userID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM saved_filters WHERE id=$1 AND user_id=$2`, id, userID)
	if err != nil {
		return fmt.Errorf("deleting saved filter: %w", err)
	}
	return nil
}

func (r *SavedFilterRepo) NextPosition(ctx context.Context, userID string) (int, error) {
	var pos *int
	err := r.pool.QueryRow(ctx,
		`SELECT MAX(position) FROM saved_filters WHERE user_id = $1`, userID,
	).Scan(&pos)
	if err != nil {
		return 0, err
	}
	if pos == nil {
		return 0, nil
	}
	return *pos + 1, nil
}

type scanner interface {
	Scan(dest ...any) error
}

func scanSavedFilter(s scanner) (model.SavedFilter, error) {
	var f model.SavedFilter
	var raw []byte
	if err := s.Scan(&f.ID, &f.UserID, &f.Name, &f.Icon, &raw, &f.Position, &f.CreatedAt, &f.UpdatedAt); err != nil {
		return f, err
	}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &f.Filter); err != nil {
			return f, fmt.Errorf("decoding filter: %w", err)
		}
	}
	if f.Filter == nil {
		f.Filter = map[string]any{}
	}
	return f, nil
}
