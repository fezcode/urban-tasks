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

type TaskHandler struct {
	tasks *service.TaskService
}

func NewTaskHandler(tasks *service.TaskService) *TaskHandler {
	return &TaskHandler{tasks: tasks}
}

func (h *TaskHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	projectID := r.URL.Query().Get("projectId")

	tasks, err := h.tasks.List(r.Context(), userID, projectID)
	if err != nil {
		slog.Error("list tasks", "error", err, "userID", userID, "projectID", projectID)
		respondError(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}

	respondJSON(w, http.StatusOK, tasks)
}

func (h *TaskHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	taskID := chi.URLParam(r, "id")

	task, err := h.tasks.GetByID(r.Context(), taskID, userID)
	if err != nil {
		if errors.Is(err, service.ErrTaskNotFound) {
			respondError(w, http.StatusNotFound, "task not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to get task")
		return
	}

	respondJSON(w, http.StatusOK, task)
}

func (h *TaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())

	var req model.CreateTaskRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Title == "" {
		respondError(w, http.StatusBadRequest, "title is required")
		return
	}
	if req.ProjectID == "" {
		respondError(w, http.StatusBadRequest, "projectId is required")
		return
	}

	task, err := h.tasks.Create(r.Context(), userID, req)
	if err != nil {
		if errors.Is(err, service.ErrProjectNotFound) {
			respondError(w, http.StatusBadRequest, "project not found")
			return
		}
		if errors.Is(err, service.ErrProRequired) {
			respondError(w, http.StatusPaymentRequired, "assigning tasks requires a Pro plan")
			return
		}
		slog.Error("create task", "error", err, "userID", userID)
		respondError(w, http.StatusInternalServerError, "failed to create task")
		return
	}

	respondJSON(w, http.StatusCreated, task)
}

func (h *TaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	taskID := chi.URLParam(r, "id")

	var req model.UpdateTaskRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	task, err := h.tasks.Update(r.Context(), taskID, userID, req)
	if err != nil {
		if errors.Is(err, service.ErrTaskNotFound) {
			respondError(w, http.StatusNotFound, "task not found")
			return
		}
		if errors.Is(err, service.ErrProjectNotFound) {
			respondError(w, http.StatusBadRequest, "project not found")
			return
		}
		if errors.Is(err, service.ErrProRequired) {
			respondError(w, http.StatusPaymentRequired, "assigning tasks requires a Pro plan")
			return
		}
		slog.Error("update task", "error", err, "userID", userID, "taskID", taskID)
		respondError(w, http.StatusInternalServerError, "failed to update task")
		return
	}

	respondJSON(w, http.StatusOK, task)
}

func (h *TaskHandler) Bulk(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())

	var req model.BulkTaskRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.IDs) == 0 {
		respondError(w, http.StatusBadRequest, "ids is required")
		return
	}
	if req.Op == "" {
		respondError(w, http.StatusBadRequest, "op is required")
		return
	}
	if len(req.IDs) > 500 {
		respondError(w, http.StatusBadRequest, "too many ids (max 500)")
		return
	}

	resp, err := h.tasks.Bulk(r.Context(), userID, req)
	if err != nil {
		slog.Error("bulk tasks", "error", err, "userID", userID, "op", req.Op)
		respondError(w, http.StatusInternalServerError, "failed to apply bulk operation")
		return
	}

	respondJSON(w, http.StatusOK, resp)
}

func (h *TaskHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	taskID := chi.URLParam(r, "id")

	if err := h.tasks.Delete(r.Context(), taskID, userID); err != nil {
		if errors.Is(err, service.ErrTaskNotFound) {
			respondError(w, http.StatusNotFound, "task not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to delete task")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
