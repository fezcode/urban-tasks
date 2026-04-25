package service

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"urban-tasks/internal/model"
	"urban-tasks/internal/repository"
)

var (
	ErrCommentNotFound = errors.New("comment not found")
	ErrNotCommentOwner = errors.New("only the author can edit this comment")
)

// Mentions are inserted by the frontend as @[Display Name](user-uuid).
// Anything else (loose @name without the bracket form) is ignored — the
// frontend's autocomplete picker is the single way to bind a mention.
var mentionRE = regexp.MustCompile(`@\[[^\]]+\]\(([0-9a-fA-F\-]{36})\)`)

func extractMentions(body string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, m := range mentionRE.FindAllStringSubmatch(body, -1) {
		id := strings.ToLower(m[1])
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}

type CommentService struct {
	comments      *repository.CommentRepo
	tasks         *repository.TaskRepo
	projects      *repository.ProjectRepo
	users         *repository.UserRepo
	notifications *NotificationService
}

func NewCommentService(
	comments *repository.CommentRepo,
	tasks *repository.TaskRepo,
	projects *repository.ProjectRepo,
	users *repository.UserRepo,
	notifications *NotificationService,
) *CommentService {
	return &CommentService{
		comments:      comments,
		tasks:         tasks,
		projects:      projects,
		users:         users,
		notifications: notifications,
	}
}

func (s *CommentService) List(ctx context.Context, taskID, userID string) ([]model.TaskComment, error) {
	// Membership check via the task's project
	t, err := s.tasks.GetByID(ctx, taskID, userID)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, ErrTaskNotFound
	}
	return s.comments.ListByTask(ctx, taskID)
}

func (s *CommentService) Create(ctx context.Context, taskID, userID, body string) (*model.TaskComment, error) {
	body = strings.TrimSpace(body)
	if body == "" {
		return nil, errors.New("body is required")
	}
	t, err := s.tasks.GetByID(ctx, taskID, userID)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, ErrTaskNotFound
	}

	mentions := extractMentions(body)

	c := &model.TaskComment{
		ID:        uuid.New().String(),
		TaskID:    taskID,
		UserID:    userID,
		Body:      body,
		Mentions:  mentions,
		CreatedAt: time.Now().UTC(),
	}
	if err := s.comments.Create(ctx, c); err != nil {
		return nil, err
	}

	s.notifyComment(ctx, t, c, userID)

	// Re-read to attach author name
	saved, err := s.comments.GetByID(ctx, c.ID)
	if err != nil || saved == nil {
		return c, nil
	}
	return saved, nil
}

func (s *CommentService) Update(ctx context.Context, id, userID, body string) (*model.TaskComment, error) {
	body = strings.TrimSpace(body)
	if body == "" {
		return nil, errors.New("body is required")
	}
	c, err := s.comments.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return nil, ErrCommentNotFound
	}
	if c.UserID != userID {
		return nil, ErrNotCommentOwner
	}
	now := time.Now().UTC()
	c.Body = body
	c.Mentions = extractMentions(body)
	c.EditedAt = &now
	if err := s.comments.Update(ctx, c); err != nil {
		return nil, err
	}
	saved, err := s.comments.GetByID(ctx, id)
	if err != nil || saved == nil {
		return c, nil
	}
	return saved, nil
}

func (s *CommentService) Delete(ctx context.Context, id, userID string) error {
	c, err := s.comments.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if c == nil {
		return ErrCommentNotFound
	}
	if c.UserID != userID {
		// Defer to project admin role check
		t, err := s.tasks.GetByID(ctx, c.TaskID, userID)
		if err != nil || t == nil {
			return ErrNotCommentOwner
		}
		role, err := s.projects.GetRole(ctx, t.ProjectID, userID)
		if err != nil || role != "admin" {
			return ErrNotCommentOwner
		}
	}
	return s.comments.Delete(ctx, id)
}

func (s *CommentService) notifyComment(ctx context.Context, t *model.Task, c *model.TaskComment, authorID string) {
	if s.notifications == nil {
		return
	}
	authorName := ""
	if s.users != nil {
		if u, err := s.users.GetByID(ctx, authorID); err == nil && u != nil {
			authorName = u.Name
		}
	}
	projectName := ""
	if s.projects != nil {
		if p, err := s.projects.GetByID(ctx, t.ProjectID, authorID); err == nil && p != nil {
			projectName = p.Name
		}
	}

	notified := map[string]bool{authorID: true}

	// Mentions get a high-signal "mention" notification
	for _, uid := range c.Mentions {
		if notified[uid] {
			continue
		}
		notified[uid] = true
		_ = s.notifications.Push(ctx, uid, "task_mention", map[string]any{
			"taskId":      t.ID,
			"taskTitle":   t.Title,
			"projectId":   t.ProjectID,
			"projectName": projectName,
			"commentId":   c.ID,
			"authorId":    authorID,
			"authorName":  authorName,
			"snippet":     snippet(c.Body, 140),
		})
	}

	// Assignee gets a quieter "comment" notification (not the same as mention)
	if t.AssigneeID != nil && !notified[*t.AssigneeID] {
		notified[*t.AssigneeID] = true
		_ = s.notifications.Push(ctx, *t.AssigneeID, "task_commented", map[string]any{
			"taskId":      t.ID,
			"taskTitle":   t.Title,
			"projectId":   t.ProjectID,
			"projectName": projectName,
			"commentId":   c.ID,
			"authorId":    authorID,
			"authorName":  authorName,
			"snippet":     snippet(c.Body, 140),
		})
	}
}

func snippet(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
