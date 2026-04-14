package service

import "testing"

func TestIsValidPriority(t *testing.T) {
	tests := []struct {
		in   string
		want bool
	}{
		{"none", true},
		{"low", true},
		{"medium", true},
		{"high", true},
		{"", false},
		{"urgent", false},
		{"HIGH", false},
	}
	for _, tt := range tests {
		if got := isValidPriority(tt.in); got != tt.want {
			t.Errorf("isValidPriority(%q) = %v, want %v", tt.in, got, tt.want)
		}
	}
}
