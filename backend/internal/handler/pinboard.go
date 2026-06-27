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

type PinboardHandler struct {
	pinboard *service.PinboardService
}

func NewPinboardHandler(pinboard *service.PinboardService) *PinboardHandler {
	return &PinboardHandler{pinboard: pinboard}
}

func (h *PinboardHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	projectID := chi.URLParam(r, "id")

	board, err := h.pinboard.GetBoard(r.Context(), projectID, userID)
	if err != nil {
		if errors.Is(err, service.ErrProjectNotFound) {
			respondError(w, http.StatusNotFound, "project not found")
			return
		}
		slog.Error("get pinboard", "error", err, "projectID", projectID)
		respondError(w, http.StatusInternalServerError, "failed to load pinboard")
		return
	}
	respondJSON(w, http.StatusOK, board)
}

func (h *PinboardHandler) PinCard(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	projectID := chi.URLParam(r, "id")

	var req model.CreatePinboardCardRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.TaskID == "" {
		respondError(w, http.StatusBadRequest, "taskId is required")
		return
	}

	card, err := h.pinboard.PinCard(r.Context(), projectID, userID, req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrProjectNotFound):
			respondError(w, http.StatusNotFound, "project not found")
		case errors.Is(err, service.ErrTaskNotFound):
			respondError(w, http.StatusBadRequest, "task not found in project")
		case errors.Is(err, service.ErrTaskAlreadyPinned):
			respondError(w, http.StatusConflict, "task already pinned")
		default:
			slog.Error("pin card", "error", err, "projectID", projectID)
			respondError(w, http.StatusInternalServerError, "failed to pin task")
		}
		return
	}
	respondJSON(w, http.StatusCreated, card)
}

func (h *PinboardHandler) MoveCard(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	cardID := chi.URLParam(r, "cardId")

	var req model.UpdatePinboardCardRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	card, err := h.pinboard.MoveCard(r.Context(), cardID, userID, req)
	if err != nil {
		if errors.Is(err, service.ErrCardNotFound) {
			respondError(w, http.StatusNotFound, "card not found")
			return
		}
		slog.Error("move card", "error", err, "cardID", cardID)
		respondError(w, http.StatusInternalServerError, "failed to move card")
		return
	}
	respondJSON(w, http.StatusOK, card)
}

func (h *PinboardHandler) UnpinCard(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	cardID := chi.URLParam(r, "cardId")

	if err := h.pinboard.UnpinCard(r.Context(), cardID, userID); err != nil {
		if errors.Is(err, service.ErrCardNotFound) {
			respondError(w, http.StatusNotFound, "card not found")
			return
		}
		slog.Error("unpin card", "error", err, "cardID", cardID)
		respondError(w, http.StatusInternalServerError, "failed to unpin task")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *PinboardHandler) Connect(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	projectID := chi.URLParam(r, "id")

	var req model.CreatePinboardConnectionRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.FromTaskID == "" || req.ToTaskID == "" {
		respondError(w, http.StatusBadRequest, "fromTaskId and toTaskId are required")
		return
	}

	conn, err := h.pinboard.Connect(r.Context(), projectID, userID, req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrProjectNotFound):
			respondError(w, http.StatusNotFound, "project not found")
		case errors.Is(err, service.ErrSelfConnection):
			respondError(w, http.StatusBadRequest, "cannot connect a task to itself")
		case errors.Is(err, service.ErrTasksNotPinned):
			respondError(w, http.StatusBadRequest, "both tasks must be pinned")
		default:
			slog.Error("connect", "error", err, "projectID", projectID)
			respondError(w, http.StatusInternalServerError, "failed to connect tasks")
		}
		return
	}
	respondJSON(w, http.StatusCreated, conn)
}

func (h *PinboardHandler) Relabel(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	connID := chi.URLParam(r, "connId")

	var req model.UpdatePinboardConnectionRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	conn, err := h.pinboard.Relabel(r.Context(), connID, userID, req)
	if err != nil {
		if errors.Is(err, service.ErrConnectionNotFound) {
			respondError(w, http.StatusNotFound, "connection not found")
			return
		}
		slog.Error("relabel connection", "error", err, "connID", connID)
		respondError(w, http.StatusInternalServerError, "failed to update label")
		return
	}
	respondJSON(w, http.StatusOK, conn)
}

func (h *PinboardHandler) Disconnect(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	connID := chi.URLParam(r, "connId")

	if err := h.pinboard.Disconnect(r.Context(), connID, userID); err != nil {
		if errors.Is(err, service.ErrConnectionNotFound) {
			respondError(w, http.StatusNotFound, "connection not found")
			return
		}
		slog.Error("disconnect", "error", err, "connID", connID)
		respondError(w, http.StatusInternalServerError, "failed to remove connection")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
