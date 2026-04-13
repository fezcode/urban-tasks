package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"urban-tasks/internal/model"
	"urban-tasks/internal/repository"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrEmailTaken         = errors.New("email already registered")
	ErrInvalidToken       = errors.New("invalid or expired token")
)

type AuthService struct {
	users      *repository.UserRepo
	jwtSecret  []byte
	accessTTL  time.Duration
	refreshTTL time.Duration
}

func NewAuthService(users *repository.UserRepo, jwtSecret string, accessTTL, refreshTTL time.Duration) *AuthService {
	return &AuthService{
		users:      users,
		jwtSecret:  []byte(jwtSecret),
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}
}

func (s *AuthService) Register(ctx context.Context, req model.RegisterRequest) (*model.AuthResponse, error) {
	existing, err := s.users.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("checking email: %w", err)
	}
	if existing != nil {
		return nil, ErrEmailTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hashing password: %w", err)
	}

	now := time.Now().UTC()
	user := &model.User{
		ID:           uuid.New().String(),
		Email:        req.Email,
		Name:         req.Name,
		PasswordHash: string(hash),
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.users.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("creating user: %w", err)
	}

	return s.issueTokens(user)
}

func (s *AuthService) Login(ctx context.Context, req model.LoginRequest) (*model.AuthResponse, error) {
	user, err := s.users.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("finding user: %w", err)
	}
	if user == nil {
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	return s.issueTokens(user)
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*model.RefreshResponse, error) {
	claims, err := s.parseToken(refreshToken, "refresh")
	if err != nil {
		return nil, ErrInvalidToken
	}

	userID, _ := claims.GetSubject()

	user, err := s.users.GetByID(ctx, userID)
	if err != nil || user == nil {
		return nil, ErrInvalidToken
	}

	access, err := s.generateToken(user.ID, "access", s.accessTTL)
	if err != nil {
		return nil, err
	}
	refresh, err := s.generateToken(user.ID, "refresh", s.refreshTTL)
	if err != nil {
		return nil, err
	}

	return &model.RefreshResponse{AccessToken: access, RefreshToken: refresh}, nil
}

func (s *AuthService) ValidateAccessToken(tokenStr string) (string, error) {
	claims, err := s.parseToken(tokenStr, "access")
	if err != nil {
		return "", ErrInvalidToken
	}
	userID, _ := claims.GetSubject()
	return userID, nil
}

func (s *AuthService) issueTokens(user *model.User) (*model.AuthResponse, error) {
	access, err := s.generateToken(user.ID, "access", s.accessTTL)
	if err != nil {
		return nil, err
	}
	refresh, err := s.generateToken(user.ID, "refresh", s.refreshTTL)
	if err != nil {
		return nil, err
	}

	return &model.AuthResponse{
		AccessToken:  access,
		RefreshToken: refresh,
		User:         *user,
	}, nil
}

func (s *AuthService) generateToken(userID, tokenType string, ttl time.Duration) (string, error) {
	now := time.Now().UTC()
	claims := jwt.RegisteredClaims{
		Subject:   userID,
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		Issuer:    "urban-tasks",
		Audience:  jwt.ClaimStrings{tokenType},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

func (s *AuthService) parseToken(tokenStr, expectedType string) (jwt.Claims, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, ErrInvalidToken
	}

	aud, err := token.Claims.GetAudience()
	if err != nil || len(aud) == 0 || aud[0] != expectedType {
		return nil, ErrInvalidToken
	}

	return token.Claims, nil
}
