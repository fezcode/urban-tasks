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

	now := time.Now().UTC()
	t := &model.Task{
		ID:        uuid.New().String(),
		UserID:    userID,
		ProjectID: req.ProjectID,
		Title:     req.Title,
		Body:      req.Body,
		Status:    "todo",
		Tags:      tags,
		DueDate:   req.DueDate,
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
		t.Status = *req.Status
		if *req.Status == "done" {
			now := time.Now().UTC()
			t.CompletedAt = &now
		} else {
			t.CompletedAt = nil
		}
	}
	if req.Tags != nil {
		t.Tags = req.Tags
	}
	if req.DueDate != nil {
		t.DueDate = req.DueDate
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
