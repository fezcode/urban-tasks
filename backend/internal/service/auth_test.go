package service

import (
	"testing"
	"time"
)

func newTestAuthService() *AuthService {
	return &AuthService{
		jwtSecret:  []byte("test-secret-key-please-change"),
		accessTTL:  15 * time.Minute,
		refreshTTL: 7 * 24 * time.Hour,
	}
}

func TestGenerateAndValidateAccessToken(t *testing.T) {
	s := newTestAuthService()

	token, err := s.generateToken("user-123", "access", s.accessTTL)
	if err != nil {
		t.Fatalf("generateToken: %v", err)
	}

	userID, err := s.ValidateAccessToken(token)
	if err != nil {
		t.Fatalf("ValidateAccessToken: %v", err)
	}
	if userID != "user-123" {
		t.Errorf("userID = %q, want %q", userID, "user-123")
	}
}

func TestValidateRejectsWrongTokenType(t *testing.T) {
	s := newTestAuthService()

	// Generate a refresh token, try to validate as access token
	refresh, err := s.generateToken("user-123", "refresh", s.refreshTTL)
	if err != nil {
		t.Fatalf("generateToken: %v", err)
	}

	if _, err := s.ValidateAccessToken(refresh); err == nil {
		t.Error("expected error validating refresh token as access, got nil")
	}
}

func TestValidateRejectsExpiredToken(t *testing.T) {
	s := newTestAuthService()

	expired, err := s.generateToken("user-123", "access", -1*time.Minute)
	if err != nil {
		t.Fatalf("generateToken: %v", err)
	}

	if _, err := s.ValidateAccessToken(expired); err == nil {
		t.Error("expected error validating expired token, got nil")
	}
}

func TestValidateRejectsTamperedSignature(t *testing.T) {
	s := newTestAuthService()

	token, err := s.generateToken("user-123", "access", s.accessTTL)
	if err != nil {
		t.Fatalf("generateToken: %v", err)
	}

	// Flip the last character of the signature
	tampered := token[:len(token)-1]
	if token[len(token)-1] == 'A' {
		tampered += "B"
	} else {
		tampered += "A"
	}

	if _, err := s.ValidateAccessToken(tampered); err == nil {
		t.Error("expected error for tampered token, got nil")
	}
}
