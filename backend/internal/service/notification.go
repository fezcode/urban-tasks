package service

import (
	"context"
	"time"

	"github.com/google/uuid"

	"urban-tasks/internal/model"
	"urban-tasks/internal/repository"
)

type NotificationService struct {
	notifications *repository.NotificationRepo
}

func NewNotificationService(notifications *repository.NotificationRepo) *NotificationService {
	return &NotificationService{notifications: notifications}
}

func (s *NotificationService) Push(ctx context.Context, userID, kind string, payload map[string]any) error {
	if payload == nil {
		payload = map[string]any{}
	}
	n := &model.Notification{
		ID:        uuid.New().String(),
		UserID:    userID,
		Kind:      kind,
		Payload:   payload,
		CreatedAt: time.Now().UTC(),
	}
	return s.notifications.Create(ctx, n)
}

func (s *NotificationService) List(ctx context.Context, userID string) ([]model.Notification, error) {
	ns, err := s.notifications.ListByUser(ctx, userID, 100)
	if err != nil {
		return nil, err
	}
	if ns == nil {
		ns = []model.Notification{}
	}
	return ns, nil
}

func (s *NotificationService) UnreadCount(ctx context.Context, userID string) (int, error) {
	return s.notifications.UnreadCount(ctx, userID)
}

func (s *NotificationService) MarkRead(ctx context.Context, id, userID string) error {
	return s.notifications.MarkRead(ctx, id, userID, time.Now().UTC())
}

func (s *NotificationService) MarkAllRead(ctx context.Context, userID string) error {
	return s.notifications.MarkAllRead(ctx, userID, time.Now().UTC())
}
