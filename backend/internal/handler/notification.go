package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"urban-tasks/internal/middleware"
	"urban-tasks/internal/service"
)

type NotificationHandler struct {
	notifications *service.NotificationService
}

func NewNotificationHandler(notifications *service.NotificationService) *NotificationHandler {
	return &NotificationHandler{notifications: notifications}
}

func (h *NotificationHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	ns, err := h.notifications.List(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list notifications")
		return
	}
	unread, err := h.notifications.UnreadCount(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to count unread")
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"items":  ns,
		"unread": unread,
	})
}

func (h *NotificationHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	if err := h.notifications.MarkRead(r.Context(), id, userID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *NotificationHandler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if err := h.notifications.MarkAllRead(r.Context(), userID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
