package service

import (
	"testing"
	"time"
)

func TestIsValidRecurrence(t *testing.T) {
	tests := []struct {
		in   string
		want bool
	}{
		{"daily", true},
		{"weekly", true},
		{"biweekly", true},
		{"monthly", true},
		{"", false},
		{"yearly", false},
		{"DAILY", false},
	}
	for _, tt := range tests {
		if got := isValidRecurrence(tt.in); got != tt.want {
			t.Errorf("isValidRecurrence(%q) = %v, want %v", tt.in, got, tt.want)
		}
	}
}

func TestAdvanceDueDate(t *testing.T) {
	base := "2026-03-01T12:00:00Z"
	tests := []struct {
		recurrence string
		wantDate   string
	}{
		{"daily", "2026-03-02"},
		{"weekly", "2026-03-08"},
		{"biweekly", "2026-03-15"},
		{"monthly", "2026-04-01"},
	}
	for _, tt := range tests {
		got := advanceDueDate(base, tt.recurrence)
		parsed, err := time.Parse(time.RFC3339, got)
		if err != nil {
			t.Fatalf("advanceDueDate(%q, %q) returned non-RFC3339 %q: %v", base, tt.recurrence, got, err)
		}
		if parsed.Format("2006-01-02") != tt.wantDate {
			t.Errorf("advanceDueDate(%q, %q) = %q, want date %s", base, tt.recurrence, got, tt.wantDate)
		}
	}
}

func TestAdvanceDueDate_DateOnly(t *testing.T) {
	got := advanceDueDate("2026-03-01", "weekly")
	parsed, err := time.Parse(time.RFC3339, got)
	if err != nil {
		t.Fatalf("expected RFC3339 result, got %q: %v", got, err)
	}
	if parsed.Format("2006-01-02") != "2026-03-08" {
		t.Errorf("got %s, want 2026-03-08", parsed.Format("2006-01-02"))
	}
}

func TestAdvanceDueDate_InvalidInput(t *testing.T) {
	if got := advanceDueDate("not-a-date", "daily"); got != "not-a-date" {
		t.Errorf("expected passthrough of invalid input, got %q", got)
	}
}

func TestAdvanceDueDate_UnknownRecurrence(t *testing.T) {
	in := "2026-03-01T00:00:00Z"
	got := advanceDueDate(in, "yearly")
	parsed, err := time.Parse(time.RFC3339, got)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if parsed.Format("2006-01-02") != "2026-03-01" {
		t.Errorf("unknown recurrence should not advance; got %s", parsed.Format("2006-01-02"))
	}
}
