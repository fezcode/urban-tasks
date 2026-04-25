package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"urban-tasks/internal/model"
	"urban-tasks/internal/repository"
)

var ErrSavedFilterNotFound = errors.New("saved filter not found")

type SavedFilterService struct {
	repo *repository.SavedFilterRepo
}

func NewSavedFilterService(repo *repository.SavedFilterRepo) *SavedFilterService {
	return &SavedFilterService{repo: repo}
}

func (s *SavedFilterService) List(ctx context.Context, userID string) ([]model.SavedFilter, error) {
	return s.repo.ListByUser(ctx, userID)
}

func (s *SavedFilterService) Create(ctx context.Context, userID string, req model.CreateSavedFilterRequest) (*model.SavedFilter, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, errors.New("name is required")
	}
	pos, err := s.repo.NextPosition(ctx, userID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	filter := req.Filter
	if filter == nil {
		filter = map[string]any{}
	}
	f := &model.SavedFilter{
		ID:        uuid.New().String(),
		UserID:    userID,
		Name:      name,
		Icon:      req.Icon,
		Filter:    filter,
		Position:  pos,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.Create(ctx, f); err != nil {
		return nil, err
	}
	return f, nil
}

func (s *SavedFilterService) Update(ctx context.Context, id, userID string, req model.UpdateSavedFilterRequest) (*model.SavedFilter, error) {
	f, err := s.repo.GetByID(ctx, id, userID)
	if err != nil {
		return nil, err
	}
	if f == nil {
		return nil, ErrSavedFilterNotFound
	}
	if req.Name != nil {
		n := strings.TrimSpace(*req.Name)
		if n == "" {
			return nil, errors.New("name cannot be empty")
		}
		f.Name = n
	}
	if req.Icon != nil {
		if *req.Icon == "" {
			f.Icon = nil
		} else {
			f.Icon = req.Icon
		}
	}
	if req.Filter != nil {
		f.Filter = req.Filter
	}
	if req.Position != nil {
		f.Position = *req.Position
	}
	f.UpdatedAt = time.Now().UTC()
	if err := s.repo.Update(ctx, f); err != nil {
		return nil, err
	}
	return f, nil
}

func (s *SavedFilterService) Delete(ctx context.Context, id, userID string) error {
	f, err := s.repo.GetByID(ctx, id, userID)
	if err != nil {
		return err
	}
	if f == nil {
		return ErrSavedFilterNotFound
	}
	return s.repo.Delete(ctx, id, userID)
}
