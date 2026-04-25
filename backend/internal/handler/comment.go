package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"urban-tasks/internal/middleware"
	"urban-tasks/internal/model"
	"urban-tasks/internal/service"
)

type CommentHandler struct {
	svc *service.CommentService
}

func NewCommentHandler(svc *service.CommentService) *CommentHandler {
	return &CommentHandler{svc: svc}
}

func (h *CommentHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	taskID := chi.URLParam(r, "id")
	cs, err := h.svc.List(r.Context(), taskID, userID)
	if err != nil {
		if errors.Is(err, service.ErrTaskNotFound) {
			respondError(w, http.StatusNotFound, "task not found")
			return
		}
		slog.Error("list comments", "error", err, "taskID", taskID)
		respondError(w, http.StatusInternalServerError, "failed to list comments")
		return
	}
	respondJSON(w, http.StatusOK, cs)
}

func (h *CommentHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	taskID := chi.URLParam(r, "id")
	var req model.CreateCommentRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	c, err := h.svc.Create(r.Context(), taskID, userID, req.Body)
	if err != nil {
		if errors.Is(err, service.ErrTaskNotFound) {
			respondError(w, http.StatusNotFound, "task not found")
			return
		}
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusCreated, c)
}

func (h *CommentHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "cid")
	var req model.UpdateCommentRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	c, err := h.svc.Update(r.Context(), id, userID, req.Body)
	if err != nil {
		if errors.Is(err, service.ErrCommentNotFound) {
			respondError(w, http.StatusNotFound, "comment not found")
			return
		}
		if errors.Is(err, service.ErrNotCommentOwner) {
			respondError(w, http.StatusForbidden, "only the author can edit this comment")
			return
		}
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, c)
}

func (h *CommentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "cid")
	if err := h.svc.Delete(r.Context(), id, userID); err != nil {
		if errors.Is(err, service.ErrCommentNotFound) {
			respondError(w, http.StatusNotFound, "comment not found")
			return
		}
		if errors.Is(err, service.ErrNotCommentOwner) {
			respondError(w, http.StatusForbidden, "only the author or a project admin can delete this comment")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to delete comment")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
