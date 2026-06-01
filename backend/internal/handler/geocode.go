package handler

import (
	"log/slog"
	"net/http"
	"strconv"

	"urban-tasks/internal/service"
)

type GeocodeHandler struct {
	svc *service.GeocodeService
}

func NewGeocodeHandler(svc *service.GeocodeService) *GeocodeHandler {
	return &GeocodeHandler{svc: svc}
}

func (h *GeocodeHandler) Search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	results, err := h.svc.Search(r.Context(), q)
	if err != nil {
		slog.Error("geocode search", "error", err)
		// Degrade gracefully: never block the user — return an empty list.
		respondJSON(w, http.StatusOK, []any{})
		return
	}
	respondJSON(w, http.StatusOK, results)
}

func (h *GeocodeHandler) Reverse(w http.ResponseWriter, r *http.Request) {
	lat, err1 := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lon, err2 := strconv.ParseFloat(r.URL.Query().Get("lon"), 64)
	if err1 != nil || err2 != nil || lat < -90 || lat > 90 || lon < -180 || lon > 180 {
		respondError(w, http.StatusBadRequest, "valid lat and lon are required")
		return
	}
	loc, err := h.svc.Reverse(r.Context(), lat, lon)
	if err != nil {
		slog.Error("geocode reverse", "error", err)
		respondJSON(w, http.StatusOK, nil)
		return
	}
	respondJSON(w, http.StatusOK, loc)
}
