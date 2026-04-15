package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"urban-tasks/internal/model"
	"urban-tasks/internal/repository"
)

var ErrTaskNotFound = errors.New("task not found")

func isValidPriority(p string) bool {
	switch p {
	case "none", "low", "medium", "high":
		return true
	}
	return false
}

func isValidRecurrence(r string) bool {
	switch r {
	case "daily", "weekly", "biweekly", "monthly":
		return true
	}
	return false
}

func advanceDueDate(dueDate string, recurrence string) string {
	t, err := time.Parse(time.RFC3339, dueDate)
	if err != nil {
		t, err = time.Parse("2006-01-02", dueDate)
		if err != nil {
			return dueDate
		}
	}
	switch recurrence {
	case "daily":
		t = t.AddDate(0, 0, 1)
	case "weekly":
		t = t.AddDate(0, 0, 7)
	case "biweekly":
		t = t.AddDate(0, 0, 14)
	case "monthly":
		t = t.AddDate(0, 1, 0)
	}
	return t.Format(time.RFC3339)
}

type TaskService struct {
	tasks    *repository.TaskRepo
	projects *repository.ProjectRepo
}

func NewTaskService(tasks *repository.TaskRepo, projects *repository.ProjectRepo) *TaskService {
	return &TaskService{tasks: tasks, projects: projects}
}

func (s *TaskService) List(ctx context.Context, userID, projectID string) ([]model.Task, error) {
	var tasks []model.Task
	var err error

	if projectID != "" {
		tasks, err = s.tasks.ListByProject(ctx, projectID, userID)
	} else {
		tasks, err = s.tasks.ListByUser(ctx, userID)
	}
	if err != nil {
		return nil, err
	}
	if tasks == nil {
		tasks = []model.Task{}
	}
	return tasks, nil
}

func (s *TaskService) GetByID(ctx context.Context, id, userID string) (*model.Task, error) {
	t, err := s.tasks.GetByID(ctx, id, userID)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, ErrTaskNotFound
	}
	return t, nil
}

func (s *TaskService) Create(ctx context.Context, userID string, req model.CreateTaskRequest) (*model.Task, error) {
	// Verify project belongs to user
	p, err := s.projects.GetByID(ctx, req.ProjectID, userID)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, ErrProjectNotFound
	}

	pos, err := s.tasks.NextPosition(ctx, req.ProjectID, userID)
	if err != nil {
		return nil, err
	}

	tags := req.Tags
	if tags == nil {
		tags = []string{}
	}

	links := req.Links
	if links == nil {
		links = []model.TaskLink{}
	}

	subtasks := req.Subtasks
	if subtasks == nil {
		subtasks = []model.Subtask{}
	}

	priority := "none"
	if req.Priority != nil && isValidPriority(*req.Priority) {
		priority = *req.Priority
	}

	now := time.Now().UTC()
	t := &model.Task{
		ID:        uuid.New().String(),
		UserID:    userID,
		ProjectID: req.ProjectID,
		Title:     req.Title,
		Body:      req.Body,
		Status:    "todo",
		Priority:  priority,
		Tags:      tags,
		Links:     links,
		Subtasks:  subtasks,
		StartDate: req.StartDate,
		DueDate:   req.DueDate,
		Recurrence: func() *string {
			if req.Recurrence != nil && isValidRecurrence(*req.Recurrence) {
				return req.Recurrence
			}
			return nil
		}(),
		Position:  pos,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.tasks.Create(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *TaskService) Update(ctx context.Context, id, userID string, req model.UpdateTaskRequest) (*model.Task, error) {
	t, err := s.tasks.GetByID(ctx, id, userID)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, ErrTaskNotFound
	}

	if req.Title != nil {
		t.Title = *req.Title
	}
	if req.Body != nil {
		t.Body = req.Body
	}
	if req.Status != nil {
		// Recurring task completed: advance due date and keep it open instead of marking done.
		if *req.Status == "done" && t.Recurrence != nil && t.DueDate != nil {
			next := advanceDueDate(*t.DueDate, *t.Recurrence)
			t.DueDate = &next
			t.Status = "todo"
			t.CompletedAt = nil
		} else {
			t.Status = *req.Status
			if *req.Status == "done" {
				now := time.Now().UTC()
				t.CompletedAt = &now
			} else {
				t.CompletedAt = nil
			}
		}
	}
	if req.Priority != nil && isValidPriority(*req.Priority) {
		t.Priority = *req.Priority
	}
	if req.Tags != nil {
		t.Tags = req.Tags
	}
	if req.Links != nil {
		t.Links = req.Links
	}
	if req.Subtasks != nil {
		t.Subtasks = req.Subtasks
	}
	if req.StartDate != nil {
		if *req.StartDate == "" {
			t.StartDate = nil
		} else {
			t.StartDate = req.StartDate
		}
	}
	if req.DueDate != nil {
		if *req.DueDate == "" {
			t.DueDate = nil
		} else {
			t.DueDate = req.DueDate
		}
	}
	if req.Recurrence != nil {
		if *req.Recurrence == "" {
			t.Recurrence = nil
		} else if isValidRecurrence(*req.Recurrence) {
			t.Recurrence = req.Recurrence
		}
	}
	if req.ProjectID != nil {
		p, err := s.projects.GetByID(ctx, *req.ProjectID, userID)
		if err != nil {
			return nil, err
		}
		if p == nil {
			return nil, ErrProjectNotFound
		}
		t.ProjectID = *req.ProjectID
	}
	if req.Position != nil {
		t.Position = *req.Position
	}
	t.UpdatedAt = time.Now().UTC()

	if err := s.tasks.Update(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *TaskService) Delete(ctx context.Context, id, userID string) error {
	t, err := s.tasks.GetByID(ctx, id, userID)
	if err != nil {
		return err
	}
	if t == nil {
		return ErrTaskNotFound
	}
	return s.tasks.Delete(ctx, id, userID)
}
