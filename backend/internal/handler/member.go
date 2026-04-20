package handler

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"urban-tasks/internal/middleware"
	"urban-tasks/internal/model"
	"urban-tasks/internal/service"
)

type MemberHandler struct {
	projects    *service.ProjectService
	invitations *service.InvitationService
}

func NewMemberHandler(projects *service.ProjectService, invitations *service.InvitationService) *MemberHandler {
	return &MemberHandler{projects: projects, invitations: invitations}
}

func (h *MemberHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	projectID := chi.URLParam(r, "id")

	members, err := h.projects.ListMembers(r.Context(), projectID, userID)
	if err != nil {
		if errors.Is(err, service.ErrProjectNotFound) {
			respondError(w, http.StatusNotFound, "project not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to list members")
		return
	}
	respondJSON(w, http.StatusOK, members)
}

func (h *MemberHandler) Remove(w http.ResponseWriter, r *http.Request) {
	actorID := middleware.UserIDFromContext(r.Context())
	projectID := chi.URLParam(r, "id")
	targetID := chi.URLParam(r, "uid")

	if err := h.projects.RemoveMember(r.Context(), projectID, actorID, targetID); err != nil {
		switch {
		case errors.Is(err, service.ErrProjectNotFound):
			respondError(w, http.StatusNotFound, "project not found")
		case errors.Is(err, service.ErrNotAdmin):
			respondError(w, http.StatusForbidden, "admin role required")
		case errors.Is(err, service.ErrLastAdmin):
			respondError(w, http.StatusConflict, "cannot remove the last admin")
		default:
			respondError(w, http.StatusInternalServerError, "failed to remove member")
		}
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *MemberHandler) ListInvitations(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	projectID := chi.URLParam(r, "id")

	invs, err := h.invitations.ListForProject(r.Context(), projectID, userID)
	if err != nil {
		if errors.Is(err, service.ErrProjectNotFound) {
			respondError(w, http.StatusNotFound, "project not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to list invitations")
		return
	}
	respondJSON(w, http.StatusOK, invs)
}

func (h *MemberHandler) CreateInvitation(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	projectID := chi.URLParam(r, "id")

	var req model.CreateInvitationRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" {
		respondError(w, http.StatusBadRequest, "email is required")
		return
	}

	inv, err := h.invitations.Create(r.Context(), projectID, userID, req.Email)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrProjectNotFound):
			respondError(w, http.StatusNotFound, "project not found")
		case errors.Is(err, service.ErrNotAdmin):
			respondError(w, http.StatusForbidden, "admin role required")
		case errors.Is(err, service.ErrAlreadyMember):
			respondError(w, http.StatusConflict, "already a member")
		case errors.Is(err, service.ErrDuplicateInvitation):
			respondError(w, http.StatusConflict, "invitation already pending")
		case errors.Is(err, service.ErrSelfInvite):
			respondError(w, http.StatusBadRequest, "cannot invite yourself")
		default:
			respondError(w, http.StatusInternalServerError, "failed to create invitation")
		}
		return
	}
	respondJSON(w, http.StatusCreated, inv)
}
