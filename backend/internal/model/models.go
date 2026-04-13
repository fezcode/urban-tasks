package model

import "time"

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type Project struct {
	ID        string    `json:"id"`
	UserID    string    `json:"-"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	IconSeed  *int      `json:"iconSeed,omitempty"`
	Position  int       `json:"position"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Task struct {
	ID          string     `json:"id"`
	UserID      string     `json:"-"`
	ProjectID   string     `json:"projectId"`
	Title       string     `json:"title"`
	Body        *string    `json:"body,omitempty"`
	Status      string     `json:"status"`
	Tags        []string   `json:"tags"`
	DueDate     *string    `json:"dueDate,omitempty"`
	Position    int        `json:"position"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	CompletedAt *time.Time `json:"completedAt,omitempty"`
}

// --- Request / Response DTOs ---

type RegisterRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	User         User   `json:"user"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type RefreshResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

type CreateProjectRequest struct {
	Name     string `json:"name"`
	Color    string `json:"color"`
	IconSeed *int   `json:"iconSeed,omitempty"`
}

type UpdateProjectRequest struct {
	Name     *string `json:"name,omitempty"`
	Color    *string `json:"color,omitempty"`
	IconSeed *int    `json:"iconSeed,omitempty"`
	Position *int    `json:"position,omitempty"`
}

type CreateTaskRequest struct {
	ProjectID string   `json:"projectId"`
	Title     string   `json:"title"`
	Body      *string  `json:"body,omitempty"`
	Tags      []string `json:"tags,omitempty"`
	DueDate   *string  `json:"dueDate,omitempty"`
}

type UpdateTaskRequest struct {
	Title     *string  `json:"title,omitempty"`
	Body      *string  `json:"body,omitempty"`
	Status    *string  `json:"status,omitempty"`
	Tags      []string `json:"tags,omitempty"`
	DueDate   *string  `json:"dueDate,omitempty"`
	ProjectID *string  `json:"projectId,omitempty"`
	Position  *int     `json:"position,omitempty"`
}
