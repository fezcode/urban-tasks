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

type SavedFilterHandler struct {
	svc *service.SavedFilterService
}

func NewSavedFilterHandler(svc *service.SavedFilterService) *SavedFilterHandler {
	return &SavedFilterHandler{svc: svc}
}

func (h *SavedFilterHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	filters, err := h.svc.List(r.Context(), userID)
	if err != nil {
		slog.Error("list saved filters", "error", err, "userID", userID)
		respondError(w, http.StatusInternalServerError, "failed to list saved filters")
		return
	}
	respondJSON(w, http.StatusOK, filters)
}

func (h *SavedFilterHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	var req model.CreateSavedFilterRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	f, err := h.svc.Create(r.Context(), userID, req)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusCreated, f)
}

func (h *SavedFilterHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	var req model.UpdateSavedFilterRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	f, err := h.svc.Update(r.Context(), id, userID, req)
	if err != nil {
		if errors.Is(err, service.ErrSavedFilterNotFound) {
			respondError(w, http.StatusNotFound, "saved filter not found")
			return
		}
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, f)
}

func (h *SavedFilterHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	if err := h.svc.Delete(r.Context(), id, userID); err != nil {
		if errors.Is(err, service.ErrSavedFilterNotFound) {
			respondError(w, http.StatusNotFound, "saved filter not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to delete saved filter")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
