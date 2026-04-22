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

var (
	ErrInvitationNotFound  = errors.New("invitation not found")
	ErrInvitationExpired   = errors.New("invitation expired")
	ErrInvitationNotYours  = errors.New("invitation not addressed to you")
	ErrAlreadyMember       = errors.New("user is already a member")
	ErrDuplicateInvitation = errors.New("an invitation is already pending for this email")
	ErrSelfInvite          = errors.New("cannot invite yourself")
)

const InvitationTTL = 12 * time.Hour

type InvitationService struct {
	invitations   *repository.InvitationRepo
	projects      *repository.ProjectRepo
	users         *repository.UserRepo
	notifications *NotificationService
}

func NewInvitationService(invitations *repository.InvitationRepo, projects *repository.ProjectRepo, users *repository.UserRepo, notifications *NotificationService) *InvitationService {
	return &InvitationService{invitations: invitations, projects: projects, users: users, notifications: notifications}
}

// Create: an admin invites someone by email. If the email matches a user, invitee_id is attached.
func (s *InvitationService) Create(ctx context.Context, projectID, inviterID, email string) (*model.Invitation, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return nil, errors.New("email required")
	}

	role, err := s.projects.GetRole(ctx, projectID, inviterID)
	if err != nil {
		return nil, err
	}
	if role == "" {
		return nil, ErrProjectNotFound
	}
	if role != "admin" {
		return nil, ErrNotAdmin
	}

	inviter, err := s.users.GetByID(ctx, inviterID)
	if err != nil || inviter == nil {
		return nil, ErrInvalidCredentials
	}
	if err := RequirePro(inviter, time.Now().UTC()); err != nil {
		return nil, err
	}
	if strings.EqualFold(inviter.Email, email) {
		return nil, ErrSelfInvite
	}

	// Dedup: existing pending invitation?
	pending, err := s.invitations.HasPending(ctx, projectID, email)
	if err != nil {
		return nil, err
	}
	if pending {
		return nil, ErrDuplicateInvitation
	}

	// Existing user? If yes, reject if already a member.
	var inviteeID *string
	existing, err := s.users.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		role, err := s.projects.GetRole(ctx, projectID, existing.ID)
		if err != nil {
			return nil, err
		}
		if role != "" {
			return nil, ErrAlreadyMember
		}
		id := existing.ID
		inviteeID = &id
	}

	now := time.Now().UTC()
	inv := &model.Invitation{
		ID:           uuid.New().String(),
		ProjectID:    projectID,
		InviterID:    inviterID,
		InviteeEmail: email,
		InviteeID:    inviteeID,
		Status:       "pending",
		ExpiresAt:    now.Add(InvitationTTL),
		CreatedAt:    now,
	}
	if err := s.invitations.Create(ctx, inv); err != nil {
		return nil, err
	}

	// Notify the invitee if they are a known user.
	if existing != nil {
		p, _ := s.projects.GetByID(ctx, projectID, inviterID)
		projName := ""
		if p != nil {
			projName = p.Name
		}
		_ = s.notifications.Push(ctx, existing.ID, "invitation_received", map[string]any{
			"invitationId": inv.ID,
			"projectId":    projectID,
			"projectName":  projName,
			"inviterId":    inviter.ID,
			"inviterName":  inviter.Name,
		})
	}

	return s.invitations.GetByID(ctx, inv.ID)
}

func (s *InvitationService) ListForUser(ctx context.Context, userID string) ([]model.Invitation, error) {
	u, err := s.users.GetByID(ctx, userID)
	if err != nil || u == nil {
		return nil, ErrInvalidCredentials
	}
	invs, err := s.invitations.ListForUser(ctx, userID, u.Email)
	if err != nil {
		return nil, err
	}
	if invs == nil {
		invs = []model.Invitation{}
	}
	return invs, nil
}

func (s *InvitationService) ListForProject(ctx context.Context, projectID, userID string) ([]model.Invitation, error) {
	role, err := s.projects.GetRole(ctx, projectID, userID)
	if err != nil {
		return nil, err
	}
	if role == "" {
		return nil, ErrProjectNotFound
	}
	invs, err := s.invitations.ListForProject(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if invs == nil {
		invs = []model.Invitation{}
	}
	return invs, nil
}

// Respond: accept or reject.
func (s *InvitationService) Respond(ctx context.Context, invitationID, userID, status string) (*model.Invitation, error) {
	if status != "accepted" && status != "rejected" {
		return nil, errors.New("invalid status")
	}
	inv, err := s.invitations.GetByID(ctx, invitationID)
	if err != nil {
		return nil, err
	}
	if inv == nil {
		return nil, ErrInvitationNotFound
	}

	u, err := s.users.GetByID(ctx, userID)
	if err != nil || u == nil {
		return nil, ErrInvalidCredentials
	}
	addressed := (inv.InviteeID != nil && *inv.InviteeID == userID) || strings.EqualFold(inv.InviteeEmail, u.Email)
	if !addressed {
		return nil, ErrInvitationNotYours
	}

	if inv.Status != "pending" {
		return nil, ErrInvitationNotFound
	}
	if time.Now().After(inv.ExpiresAt) {
		_ = s.invitations.Respond(ctx, inv.ID, "expired", time.Now().UTC())
		return nil, ErrInvitationExpired
	}

	now := time.Now().UTC()
	if err := s.invitations.Respond(ctx, inv.ID, status, now); err != nil {
		return nil, err
	}

	if status == "accepted" {
		if err := s.projects.AddMember(ctx, inv.ProjectID, userID, "member"); err != nil {
			return nil, err
		}
	}

	// Notify inviter.
	kind := "invitation_accepted"
	if status == "rejected" {
		kind = "invitation_rejected"
	}
	_ = s.notifications.Push(ctx, inv.InviterID, kind, map[string]any{
		"invitationId": inv.ID,
		"projectId":    inv.ProjectID,
		"projectName":  inv.ProjectName,
		"inviteeId":    userID,
		"inviteeEmail": u.Email,
		"inviteeName":  u.Name,
	})

	return s.invitations.GetByID(ctx, inv.ID)
}
