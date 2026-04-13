package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"urban-tasks/internal/model"
	"urban-tasks/internal/repository"
)

var ErrProjectNotFound = errors.New("project not found")

type ProjectService struct {
	projects *repository.ProjectRepo
	tasks    *repository.TaskRepo
}

func NewProjectService(projects *repository.ProjectRepo, tasks *repository.TaskRepo) *ProjectService {
	return &ProjectService{projects: projects, tasks: tasks}
}

func (s *ProjectService) List(ctx context.Context, userID string) ([]model.Project, error) {
	projects, err := s.projects.ListByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	if projects == nil {
		projects = []model.Project{}
	}
	return projects, nil
}

func (s *ProjectService) Create(ctx context.Context, userID string, req model.CreateProjectRequest) (*model.Project, error) {
	pos, err := s.projects.NextPosition(ctx, userID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	p := &model.Project{
		ID:        uuid.New().String(),
		UserID:    userID,
		Name:      req.Name,
		Color:     req.Color,
		IconSeed:  req.IconSeed,
		Position:  pos,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.projects.Create(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *ProjectService) Update(ctx context.Context, id, userID string, req model.UpdateProjectRequest) (*model.Project, error) {
	p, err := s.projects.GetByID(ctx, id, userID)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, ErrProjectNotFound
	}

	if req.Name != nil {
		p.Name = *req.Name
	}
	if req.Color != nil {
		p.Color = *req.Color
	}
	if req.IconSeed != nil {
		p.IconSeed = req.IconSeed
	}
	if req.Position != nil {
		p.Position = *req.Position
	}
	p.UpdatedAt = time.Now().UTC()

	if err := s.projects.Update(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *ProjectService) Delete(ctx context.Context, id, userID string) error {
	p, err := s.projects.GetByID(ctx, id, userID)
	if err != nil {
		return err
	}
	if p == nil {
		return ErrProjectNotFound
	}

	if err := s.tasks.DeleteByProject(ctx, id, userID); err != nil {
		return fmt.Errorf("deleting project tasks: %w", err)
	}
	return s.projects.Delete(ctx, id, userID)
}
