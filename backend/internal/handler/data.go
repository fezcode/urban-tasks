package handler

import (
	"net/http"
	"time"

	"urban-tasks/internal/middleware"
	"urban-tasks/internal/model"
	"urban-tasks/internal/service"
)

type DataHandler struct {
	projects *service.ProjectService
	tasks    *service.TaskService
}

func NewDataHandler(projects *service.ProjectService, tasks *service.TaskService) *DataHandler {
	return &DataHandler{projects: projects, tasks: tasks}
}

type exportPayload struct {
	Version    int             `json:"version"`
	ExportedAt time.Time       `json:"exportedAt"`
	Projects   []model.Project `json:"projects"`
	Tasks      []model.Task    `json:"tasks"`
}

type importPayload struct {
	Projects []model.Project `json:"projects"`
	Tasks    []model.Task    `json:"tasks"`
}

type importResult struct {
	ProjectsCreated int `json:"projectsCreated"`
	TasksCreated    int `json:"tasksCreated"`
}

func (h *DataHandler) Export(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())

	projects, err := h.projects.List(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to export projects")
		return
	}
	tasks, err := h.tasks.List(r.Context(), userID, "")
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to export tasks")
		return
	}

	respondJSON(w, http.StatusOK, exportPayload{
		Version:    1,
		ExportedAt: time.Now().UTC(),
		Projects:   projects,
		Tasks:      tasks,
	})
}

func (h *DataHandler) Import(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())

	var req importPayload
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid import payload")
		return
	}

	// Create projects with new IDs; track old→new mapping so tasks can be relinked.
	projectIDMap := make(map[string]string, len(req.Projects))
	projectsCreated := 0
	for _, p := range req.Projects {
		created, err := h.projects.Create(r.Context(), userID, model.CreateProjectRequest{
			Name:     p.Name,
			Color:    p.Color,
			IconSeed: p.IconSeed,
		})
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to import project")
			return
		}
		projectIDMap[p.ID] = created.ID
		projectsCreated++
	}

	tasksCreated := 0
	for _, t := range req.Tasks {
		newProjectID, ok := projectIDMap[t.ProjectID]
		if !ok {
			// Task references a project not in the payload — skip.
			continue
		}
		priority := t.Priority
		created, err := h.tasks.Create(r.Context(), userID, model.CreateTaskRequest{
			ProjectID: newProjectID,
			Title:     t.Title,
			Body:      t.Body,
			Tags:      t.Tags,
			Links:     t.Links,
			Subtasks:   t.Subtasks,
			StartDate:  t.StartDate,
			DueDate:    t.DueDate,
			Recurrence: t.Recurrence,
			Priority:   &priority,
		})
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to import task")
			return
		}
		// Apply status/completedAt via Update if not default
		if t.Status != "" && t.Status != "todo" {
			_, err := h.tasks.Update(r.Context(), created.ID, userID, model.UpdateTaskRequest{
				Status: &t.Status,
			})
			if err != nil {
				respondError(w, http.StatusInternalServerError, "failed to import task status")
				return
			}
		}
		tasksCreated++
	}

	respondJSON(w, http.StatusOK, importResult{
		ProjectsCreated: projectsCreated,
		TasksCreated:    tasksCreated,
	})
}
