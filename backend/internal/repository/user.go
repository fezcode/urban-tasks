package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"urban-tasks/internal/model"
)

type UserRepo struct {
	pool *pgxpool.Pool
}

func NewUserRepo(pool *pgxpool.Pool) *UserRepo {
	return &UserRepo{pool: pool}
}

func (r *UserRepo) Create(ctx context.Context, u *model.User) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO users (id, email, name, password_hash, plan, trial_ends_at, plan_updated_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		u.ID, u.Email, u.Name, u.PasswordHash, u.Plan, u.TrialEndsAt, u.PlanUpdatedAt, u.CreatedAt, u.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("creating user: %w", err)
	}
	return nil
}

const userColumns = `id, email, name, avatar_seed, password_hash, plan, trial_ends_at, plan_updated_at, created_at, updated_at`

func scanUser(row pgx.Row, u *model.User) error {
	return row.Scan(
		&u.ID, &u.Email, &u.Name, &u.AvatarSeed, &u.PasswordHash,
		&u.Plan, &u.TrialEndsAt, &u.PlanUpdatedAt, &u.CreatedAt, &u.UpdatedAt,
	)
}

func (r *UserRepo) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	u := &model.User{}
	err := scanUser(r.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE email = $1`, email), u)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting user by email: %w", err)
	}
	return u, nil
}

func (r *UserRepo) GetByID(ctx context.Context, id string) (*model.User, error) {
	u := &model.User{}
	err := scanUser(r.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE id = $1`, id), u)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting user by id: %w", err)
	}
	return u, nil
}

// CountOwnedProjects returns how many projects user_id = userID owns,
// regardless of membership. Used for Free-tier project gating.
func (r *UserRepo) CountOwnedProjects(ctx context.Context, userID string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM projects WHERE user_id = $1`, userID,
	).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("counting owned projects: %w", err)
	}
	return n, nil
}

// SetPlan updates the user's plan tier and stamps plan_updated_at.
func (r *UserRepo) SetPlan(ctx context.Context, userID, plan string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE users SET plan = $2, plan_updated_at = NOW(), updated_at = NOW()
		 WHERE id = $1`, userID, plan,
	)
	if err != nil {
		return fmt.Errorf("setting plan: %w", err)
	}
	return nil
}

func (r *UserRepo) Update(ctx context.Context, id string, req model.UpdateUserRequest) (*model.User, error) {
	now := time.Now().UTC()
	_, err := r.pool.Exec(ctx,
		`UPDATE users SET
			name = COALESCE($2, name),
			avatar_seed = COALESCE($3, avatar_seed),
			updated_at = $4
		 WHERE id = $1`,
		id, req.Name, req.AvatarSeed, now,
	)
	if err != nil {
		return nil, fmt.Errorf("updating user: %w", err)
	}
	return r.GetByID(ctx, id)
}

func (r *UserRepo) Delete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting user: %w", err)
	}
	return nil
}
