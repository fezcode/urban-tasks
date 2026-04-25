package handler

import (
	"log/slog"
	"net/http"
	"strconv"

	"urban-tasks/internal/middleware"
	"urban-tasks/internal/service"
)

type SearchHandler struct {
	svc *service.SearchService
}

func NewSearchHandler(svc *service.SearchService) *SearchHandler {
	return &SearchHandler{svc: svc}
}

func (h *SearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	q := r.URL.Query().Get("q")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	res, err := h.svc.Search(r.Context(), userID, q, limit)
	if err != nil {
		slog.Error("search", "error", err, "userID", userID)
		respondError(w, http.StatusInternalServerError, "search failed")
		return
	}
	respondJSON(w, http.StatusOK, res)
}
