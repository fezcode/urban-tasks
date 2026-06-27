package model

import (
	"math"
	"strings"
	"time"
)

const maxConnectionLabelLen = 80

// PinboardCard is a task pinned onto a project's board at a logical (x,y).
type PinboardCard struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"projectId"`
	TaskID    string    `json:"taskId"`
	X         float64   `json:"x"`
	Y         float64   `json:"y"`
	CreatedAt time.Time `json:"createdAt"`
}

// PinboardConnection is an undirected labeled string between two pinned tasks.
// The pair is normalized smaller-id-first (a <= b) so A-B and B-A dedupe.
type PinboardConnection struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"projectId"`
	ATaskID   string    `json:"aTaskId"`
	BTaskID   string    `json:"bTaskId"`
	Label     string    `json:"label"`
	CreatedAt time.Time `json:"createdAt"`
}

// PinboardBoard is the full board payload for a project.
type PinboardBoard struct {
	Cards       []PinboardCard       `json:"cards"`
	Connections []PinboardConnection `json:"connections"`
}

type CreatePinboardCardRequest struct {
	TaskID string  `json:"taskId"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
}

type UpdatePinboardCardRequest struct {
	X *float64 `json:"x,omitempty"`
	Y *float64 `json:"y,omitempty"`
}

type CreatePinboardConnectionRequest struct {
	FromTaskID string `json:"fromTaskId"`
	ToTaskID   string `json:"toTaskId"`
	Label      string `json:"label,omitempty"`
}

type UpdatePinboardConnectionRequest struct {
	Label string `json:"label"`
}

// SanitizeBoardCoord clamps a coordinate to a finite, sane range.
func SanitizeBoardCoord(v float64) float64 {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return 0
	}
	const limit = 100000
	if v < -limit {
		return -limit
	}
	if v > limit {
		return limit
	}
	return v
}

// SanitizeConnectionLabel trims and caps a string's label.
func SanitizeConnectionLabel(s string) string {
	s = strings.TrimSpace(s)
	if r := []rune(s); len(r) > maxConnectionLabelLen {
		s = string(r[:maxConnectionLabelLen])
	}
	return s
}

// NormalizePair orders a task-id pair so the smaller id comes first (undirected).
func NormalizePair(a, b string) (string, string) {
	if a <= b {
		return a, b
	}
	return b, a
}
