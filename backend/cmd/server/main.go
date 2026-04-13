package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"

	"urban-tasks/internal/config"
	"urban-tasks/internal/database"
	"urban-tasks/internal/handler"
	"urban-tasks/internal/middleware"
	"urban-tasks/internal/repository"
	"urban-tasks/internal/service"
)

func main() {
	// Structured JSON logging
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("loading config", "error", err)
		os.Exit(1)
	}

	slog.Info("starting server", "port", cfg.Port, "env", cfg.Environment)

	// Database
	ctx := context.Background()
	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("connecting to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := database.RunMigrations(cfg.DatabaseURL, cfg.MigrationsPath); err != nil {
		slog.Error("running migrations", "error", err)
		os.Exit(1)
	}

	// Repositories
	userRepo := repository.NewUserRepo(pool)
	projectRepo := repository.NewProjectRepo(pool)
	taskRepo := repository.NewTaskRepo(pool)

	// Services
	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)
	projectSvc := service.NewProjectService(projectRepo, taskRepo)
	taskSvc := service.NewTaskService(taskRepo, projectRepo)

	// Handlers
	authH := handler.NewAuthHandler(authSvc)
	projectH := handler.NewProjectHandler(projectSvc)
	taskH := handler.NewTaskHandler(taskSvc)

	// Router
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Recovery)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logging)
	r.Use(chimw.RealIP)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "X-Request-ID"},
		ExposedHeaders:   []string{"X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(httprate.LimitByIP(cfg.RateLimitRPS, time.Minute))
	r.Use(chimw.Compress(5))

	// Public routes
	r.Get("/health", handler.HealthCheck)

	r.Route("/api/v1", func(api chi.Router) {
		// Auth (public)
		api.Post("/auth/register", authH.Register)
		api.Post("/auth/login", authH.Login)
		api.Post("/auth/refresh", authH.Refresh)

		// Protected routes
		api.Group(func(protected chi.Router) {
			protected.Use(middleware.Auth(authSvc))

			// Projects
			protected.Get("/projects", projectH.List)
			protected.Post("/projects", projectH.Create)
			protected.Patch("/projects/{id}", projectH.Update)
			protected.Delete("/projects/{id}", projectH.Delete)

			// Tasks
			protected.Get("/tasks", taskH.List)
			protected.Get("/tasks/{id}", taskH.Get)
			protected.Post("/tasks", taskH.Create)
			protected.Patch("/tasks/{id}", taskH.Update)
			protected.Delete("/tasks/{id}", taskH.Delete)
		})
	})

	// Server with graceful shutdown
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("listening", "addr", srv.Addr)
		errCh <- srv.ListenAndServe()
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-quit:
		slog.Info("shutting down", "signal", sig)
	case err := <-errCh:
		slog.Error("server error", "error", err)
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("forced shutdown", "error", err)
		os.Exit(1)
	}

	slog.Info("server stopped")
}
