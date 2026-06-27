package model

import (
	"math"
	"regexp"
	"strings"
	"time"
)

const maxConnectionLabelLen = 80

var hexColorRe = regexp.MustCompile(`^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$`)

// PinboardCard is a task pinned onto a project's board at a logical (x,y).
// Color is an optional hand-picked accent (#hex); nil means "auto" (priority).
type PinboardCard struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"projectId"`
	TaskID    string    `json:"taskId"`
	X         float64   `json:"x"`
	Y         float64   `json:"y"`
	Color     *string   `json:"color,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// PinboardLinkedTask is a task strung to another on the board — surfaced in the
// task detail view so connections are visible without opening the board.
type PinboardLinkedTask struct {
	ConnectionID string `json:"connectionId"`
	Label        string `json:"label"`
	TaskID       string `json:"taskId"`
	Title        string `json:"title"`
	Status       string `json:"status"`
	Priority     string `json:"priority"`
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
	BgColor     *string              `json:"bgColor,omitempty"`
}

type CreatePinboardCardRequest struct {
	TaskID string  `json:"taskId"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
}

// UpdatePinboardCardRequest — all fields optional. A present Color of "" clears
// it (back to auto); a present hex sets it; absent leaves it unchanged.
type UpdatePinboardCardRequest struct {
	X     *float64 `json:"x,omitempty"`
	Y     *float64 `json:"y,omitempty"`
	Color *string  `json:"color,omitempty"`
}

type UpdatePinboardBoardRequest struct {
	BgColor *string `json:"bgColor,omitempty"`
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

// SanitizeColor normalizes a #hex color (3/4/6/8 digits), or returns nil for
// empty/invalid input (treated as "no color / auto").
func SanitizeColor(s *string) *string {
	if s == nil {
		return nil
	}
	v := strings.ToLower(strings.TrimSpace(*s))
	if v == "" || !hexColorRe.MatchString(v) {
		return nil
	}
	return &v
}

// NormalizePair orders a task-id pair so the smaller id comes first (undirected).
func NormalizePair(a, b string) (string, string) {
	if a <= b {
		return a, b
	}
	return b, a
}
