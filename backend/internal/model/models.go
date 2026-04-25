package model

import "time"

type User struct {
	ID             string     `json:"id"`
	Email          string     `json:"email"`
	Name           string     `json:"name"`
	AvatarSeed     *string    `json:"avatarSeed,omitempty"`
	PasswordHash   string     `json:"-"`
	Plan           string     `json:"plan"`
	TrialEndsAt    *time.Time `json:"trialEndsAt,omitempty"`
	EffectivePlan  string     `json:"effectivePlan"`
	PlanUpdatedAt  time.Time  `json:"planUpdatedAt"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

type UpdateUserRequest struct {
	Name       *string `json:"name,omitempty"`
	AvatarSeed *string `json:"avatarSeed,omitempty"`
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

type TaskLink struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	URL   string `json:"url"`
}

type Subtask struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Done  bool   `json:"done"`
}

type Task struct {
	ID          string     `json:"id"`
	UserID      string     `json:"-"`
	ProjectID   string     `json:"projectId"`
	Title       string     `json:"title"`
	Body        *string    `json:"body,omitempty"`
	Status      string     `json:"status"`
	Priority    string     `json:"priority"`
	Tags        []string   `json:"tags"`
	Links       []TaskLink `json:"links"`
	Subtasks    []Subtask  `json:"subtasks"`
	StartDate   *string    `json:"startDate,omitempty"`
	DueDate     *string    `json:"dueDate,omitempty"`
	Recurrence  *string    `json:"recurrence,omitempty"`
	Position    int        `json:"position"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	CompletedAt *time.Time `json:"completedAt,omitempty"`
	CreatedBy   *string    `json:"createdBy,omitempty"`
	UpdatedBy   *string    `json:"updatedBy,omitempty"`
	AssigneeID  *string    `json:"assigneeId,omitempty"`
}

type TaskComment struct {
	ID         string     `json:"id"`
	TaskID     string     `json:"taskId"`
	UserID     string     `json:"userId"`
	AuthorName string     `json:"authorName,omitempty"`
	AuthorSeed *string    `json:"authorAvatarSeed,omitempty"`
	Body       string     `json:"body"`
	Mentions   []string   `json:"mentions"`
	EditedAt   *time.Time `json:"editedAt,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
}

type CreateCommentRequest struct {
	Body string `json:"body"`
}

type UpdateCommentRequest struct {
	Body string `json:"body"`
}

// SavedFilter is a user-defined named view, e.g. "My high-priority due this week".
// Filter holds an opaque JSON object the frontend interprets (status, priority,
// projectIds, tags, dueWithinDays, etc.) — kept loose so frontend can extend it
// without a migration.
type SavedFilter struct {
	ID        string         `json:"id"`
	UserID    string         `json:"-"`
	Name      string         `json:"name"`
	Icon      *string        `json:"icon,omitempty"`
	Filter    map[string]any `json:"filter"`
	Position  int            `json:"position"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
}

type CreateSavedFilterRequest struct {
	Name   string         `json:"name"`
	Icon   *string        `json:"icon,omitempty"`
	Filter map[string]any `json:"filter"`
}

type UpdateSavedFilterRequest struct {
	Name     *string        `json:"name,omitempty"`
	Icon     *string        `json:"icon,omitempty"`
	Filter   map[string]any `json:"filter,omitempty"`
	Position *int           `json:"position,omitempty"`
}

// --- Multi-user: membership, invitations, notifications ---

type ProjectMember struct {
	ProjectID  string    `json:"projectId"`
	UserID     string    `json:"userId"`
	Role       string    `json:"role"`
	Name       string    `json:"name"`
	Email      string    `json:"email"`
	AvatarSeed *string   `json:"avatarSeed,omitempty"`
	JoinedAt   time.Time `json:"joinedAt"`
}

type Invitation struct {
	ID           string     `json:"id"`
	ProjectID    string     `json:"projectId"`
	ProjectName  string     `json:"projectName,omitempty"`
	ProjectColor string     `json:"projectColor,omitempty"`
	InviterID    string     `json:"inviterId"`
	InviterName  string     `json:"inviterName,omitempty"`
	InviteeEmail string     `json:"inviteeEmail"`
	InviteeID    *string    `json:"inviteeId,omitempty"`
	Status       string     `json:"status"`
	ExpiresAt    time.Time  `json:"expiresAt"`
	CreatedAt    time.Time  `json:"createdAt"`
	RespondedAt  *time.Time `json:"respondedAt,omitempty"`
}

type Notification struct {
	ID        string         `json:"id"`
	UserID    string         `json:"userId"`
	Kind      string         `json:"kind"`
	Payload   map[string]any `json:"payload"`
	ReadAt    *time.Time     `json:"readAt,omitempty"`
	CreatedAt time.Time      `json:"createdAt"`
}

type CreateInvitationRequest struct {
	Email string `json:"email"`
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
	ProjectID  string     `json:"projectId"`
	Title      string     `json:"title"`
	Body       *string    `json:"body,omitempty"`
	Tags       []string   `json:"tags,omitempty"`
	Links      []TaskLink `json:"links,omitempty"`
	Subtasks   []Subtask  `json:"subtasks,omitempty"`
	StartDate  *string    `json:"startDate,omitempty"`
	DueDate    *string    `json:"dueDate,omitempty"`
	Priority   *string    `json:"priority,omitempty"`
	Recurrence *string    `json:"recurrence,omitempty"`
	AssigneeID *string    `json:"assigneeId,omitempty"`
}

// BulkTaskRequest applies one operation to many tasks at once.
// op values: "complete", "reopen", "delete", "set_priority", "move", "add_tags", "remove_tags".
type BulkTaskRequest struct {
	IDs     []string       `json:"ids"`
	Op      string         `json:"op"`
	Payload map[string]any `json:"payload,omitempty"`
}

type BulkTaskFailure struct {
	ID    string `json:"id"`
	Error string `json:"error"`
}

type BulkTaskResponse struct {
	Updated int               `json:"updated"`
	Failed  []BulkTaskFailure `json:"failed"`
}

type UpdateTaskRequest struct {
	Title      *string    `json:"title,omitempty"`
	Body       *string    `json:"body,omitempty"`
	Status     *string    `json:"status,omitempty"`
	Priority   *string    `json:"priority,omitempty"`
	Tags       []string   `json:"tags,omitempty"`
	Links      []TaskLink `json:"links,omitempty"`
	Subtasks   []Subtask  `json:"subtasks,omitempty"`
	StartDate  *string    `json:"startDate,omitempty"`
	DueDate    *string    `json:"dueDate,omitempty"`
	Recurrence *string    `json:"recurrence,omitempty"`
	ProjectID  *string    `json:"projectId,omitempty"`
	Position   *int       `json:"position,omitempty"`
	AssigneeID *string    `json:"assigneeId,omitempty"`
}
