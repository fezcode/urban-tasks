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

var (
	ErrProjectNotFound = errors.New("project not found")
	ErrNotAdmin        = errors.New("admin role required")
	ErrLastAdmin       = errors.New("cannot remove the last admin")
)

type ProjectService struct {
	projects *repository.ProjectRepo
	tasks    *repository.TaskRepo
	users    *repository.UserRepo
}

func NewProjectService(projects *repository.ProjectRepo, tasks *repository.TaskRepo, users *repository.UserRepo) *ProjectService {
	return &ProjectService{projects: projects, tasks: tasks, users: users}
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
	if s.users != nil {
		user, err := s.users.GetByID(ctx, userID)
		if err != nil {
			return nil, err
		}
		if user != nil {
			limit := ProjectLimit(EffectivePlan(user, time.Now().UTC()))
			if limit > 0 {
				owned, err := s.users.CountOwnedProjects(ctx, userID)
				if err != nil {
					return nil, err
				}
				if owned >= limit {
					return nil, ErrProjectLimitReached
				}
			}
		}
	}

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
	role, err := s.projects.GetRole(ctx, id, userID)
	if err != nil {
		return nil, err
	}
	if role == "" {
		return nil, ErrProjectNotFound
	}
	// Position changes are personal-ish but treated as project-wide here; any member can reorder.
	// Name/color/icon changes require admin.
	if role != "admin" && (req.Name != nil || req.Color != nil || req.IconSeed != nil) {
		return nil, ErrNotAdmin
	}

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
	role, err := s.projects.GetRole(ctx, id, userID)
	if err != nil {
		return err
	}
	if role == "" {
		return ErrProjectNotFound
	}
	if role != "admin" {
		return ErrNotAdmin
	}

	if err := s.tasks.DeleteByProject(ctx, id); err != nil {
		return fmt.Errorf("deleting project tasks: %w", err)
	}
	return s.projects.Delete(ctx, id)
}

// --- members ---

func (s *ProjectService) ListMembers(ctx context.Context, projectID, userID string) ([]model.ProjectMember, error) {
	role, err := s.projects.GetRole(ctx, projectID, userID)
	if err != nil {
		return nil, err
	}
	if role == "" {
		return nil, ErrProjectNotFound
	}
	members, err := s.projects.ListMembers(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if members == nil {
		members = []model.ProjectMember{}
	}
	return members, nil
}

func (s *ProjectService) RemoveMember(ctx context.Context, projectID, actorID, targetID string) error {
	role, err := s.projects.GetRole(ctx, projectID, actorID)
	if err != nil {
		return err
	}
	if role == "" {
		return ErrProjectNotFound
	}
	// Anyone can remove themselves; only admins can remove others.
	if targetID != actorID && role != "admin" {
		return ErrNotAdmin
	}
	targetRole, err := s.projects.GetRole(ctx, projectID, targetID)
	if err != nil {
		return err
	}
	if targetRole == "" {
		return nil // idempotent
	}
	if targetRole == "admin" {
		n, err := s.projects.AdminCount(ctx, projectID)
		if err != nil {
			return err
		}
		if n <= 1 {
			return ErrLastAdmin
		}
	}
	return s.projects.RemoveMember(ctx, projectID, targetID)
}
