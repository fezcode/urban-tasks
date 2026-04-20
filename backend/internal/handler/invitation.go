package handler

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"urban-tasks/internal/middleware"
	"urban-tasks/internal/service"
)

type InvitationHandler struct {
	invitations *service.InvitationService
}

func NewInvitationHandler(invitations *service.InvitationService) *InvitationHandler {
	return &InvitationHandler{invitations: invitations}
}

func (h *InvitationHandler) ListMine(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	invs, err := h.invitations.ListForUser(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list invitations")
		return
	}
	respondJSON(w, http.StatusOK, invs)
}

func (h *InvitationHandler) Accept(w http.ResponseWriter, r *http.Request) {
	h.respond(w, r, "accepted")
}

func (h *InvitationHandler) Reject(w http.ResponseWriter, r *http.Request) {
	h.respond(w, r, "rejected")
}

func (h *InvitationHandler) respond(w http.ResponseWriter, r *http.Request, status string) {
	userID := middleware.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")

	inv, err := h.invitations.Respond(r.Context(), id, userID, status)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvitationNotFound):
			respondError(w, http.StatusNotFound, "invitation not found")
		case errors.Is(err, service.ErrInvitationExpired):
			respondError(w, http.StatusGone, "invitation expired")
		case errors.Is(err, service.ErrInvitationNotYours):
			respondError(w, http.StatusForbidden, "not your invitation")
		default:
			respondError(w, http.StatusInternalServerError, "failed to respond")
		}
		return
	}
	respondJSON(w, http.StatusOK, inv)
}
