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

	"net/url"
	"strings"

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
	invitationRepo := repository.NewInvitationRepo(pool)
	notificationRepo := repository.NewNotificationRepo(pool)
	savedFilterRepo := repository.NewSavedFilterRepo(pool)
	commentRepo := repository.NewCommentRepo(pool)
	pinboardRepo := repository.NewPinboardRepo(pool)

	// Services
	authSvc := service.NewAuthService(userRepo, invitationRepo, cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)
	projectSvc := service.NewProjectService(projectRepo, taskRepo, userRepo)
	notificationSvc := service.NewNotificationService(notificationRepo)
	taskSvc := service.NewTaskService(taskRepo, projectRepo, userRepo, notificationSvc)
	invitationSvc := service.NewInvitationService(invitationRepo, projectRepo, userRepo, notificationSvc)
	savedFilterSvc := service.NewSavedFilterService(savedFilterRepo)
	commentSvc := service.NewCommentService(commentRepo, taskRepo, projectRepo, userRepo, notificationSvc)
	searchSvc := service.NewSearchService(pool)
	geocodeSvc := service.NewGeocodeService(cfg.NominatimURL, "urban-tasks/1.0 (https://github.com/fezcode/urban-tasks)", nil)
	pinboardSvc := service.NewPinboardService(pinboardRepo, taskRepo, projectRepo)

	// Handlers
	authH := handler.NewAuthHandler(authSvc)
	projectH := handler.NewProjectHandler(projectSvc)
	taskH := handler.NewTaskHandler(taskSvc)
	dataH := handler.NewDataHandler(projectSvc, taskSvc)
	memberH := handler.NewMemberHandler(projectSvc, invitationSvc)
	invitationH := handler.NewInvitationHandler(invitationSvc)
	notificationH := handler.NewNotificationHandler(notificationSvc)
	savedFilterH := handler.NewSavedFilterHandler(savedFilterSvc)
	commentH := handler.NewCommentHandler(commentSvc)
	searchH := handler.NewSearchHandler(searchSvc)
	geocodeH := handler.NewGeocodeHandler(geocodeSvc)
	pinboardH := handler.NewPinboardHandler(pinboardSvc)

	// Router
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Recovery)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logging)
	r.Use(chimw.RealIP)
	corsOpts := cors.Options{
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "X-Request-ID"},
		ExposedHeaders:   []string{"X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	}
	if cfg.Environment == "development" {
		// Dev: accept any localhost/127.0.0.1 origin on any port, plus any explicit allow-list entries.
		explicit := make(map[string]bool, len(cfg.AllowedOrigins))
		for _, o := range cfg.AllowedOrigins {
			explicit[o] = true
		}
		corsOpts.AllowOriginFunc = func(_ *http.Request, origin string) bool {
			if explicit[origin] {
				return true
			}
			u, err := url.Parse(origin)
			if err != nil {
				return false
			}
			host := u.Hostname()
			return host == "localhost" || host == "127.0.0.1" || strings.HasSuffix(host, ".localhost")
		}
	} else {
		corsOpts.AllowedOrigins = cfg.AllowedOrigins
	}
	r.Use(cors.Handler(corsOpts))
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
			protected.Post("/tasks/bulk", taskH.Bulk)
			protected.Patch("/tasks/{id}", taskH.Update)
			protected.Delete("/tasks/{id}", taskH.Delete)

			// Data export / import
			protected.Get("/data/export", dataH.Export)
			protected.Post("/data/import", dataH.Import)

			// Current user profile
			protected.Get("/me", authH.GetMe)
			protected.Patch("/me", authH.UpdateMe)
			protected.Delete("/me", authH.DeleteMe)

			// Project members + invitations
			protected.Get("/projects/{id}/members", memberH.List)
			protected.Delete("/projects/{id}/members/{uid}", memberH.Remove)
			protected.Get("/projects/{id}/invitations", memberH.ListInvitations)
			protected.Post("/projects/{id}/invitations", memberH.CreateInvitation)

			// My invitations
			protected.Get("/invitations", invitationH.ListMine)
			protected.Post("/invitations/{id}/accept", invitationH.Accept)
			protected.Post("/invitations/{id}/reject", invitationH.Reject)

			// Global search
			protected.Get("/search", searchH.Search)

			// Geocoding (OpenStreetMap / Nominatim proxy)
			protected.Get("/geocode/search", geocodeH.Search)
			protected.Get("/geocode/reverse", geocodeH.Reverse)

			// Pinboard (per-project corkboard of pinned tasks + string)
			protected.Get("/projects/{id}/pinboard", pinboardH.Get)
			protected.Patch("/projects/{id}/pinboard", pinboardH.SetBoardColor)
			protected.Post("/projects/{id}/pinboard/cards", pinboardH.PinCard)
			protected.Patch("/pinboard/cards/{cardId}", pinboardH.UpdateCard)
			protected.Delete("/pinboard/cards/{cardId}", pinboardH.UnpinCard)
			protected.Post("/projects/{id}/pinboard/connections", pinboardH.Connect)
			protected.Patch("/pinboard/connections/{connId}", pinboardH.Relabel)
			protected.Delete("/pinboard/connections/{connId}", pinboardH.Disconnect)
			protected.Get("/tasks/{id}/pinboard", pinboardH.LinkedTasks)

			// Task comments
			protected.Get("/tasks/{id}/comments", commentH.List)
			protected.Post("/tasks/{id}/comments", commentH.Create)
			protected.Patch("/comments/{cid}", commentH.Update)
			protected.Delete("/comments/{cid}", commentH.Delete)

			// Saved filters (smart lists)
			protected.Get("/saved-filters", savedFilterH.List)
			protected.Post("/saved-filters", savedFilterH.Create)
			protected.Patch("/saved-filters/{id}", savedFilterH.Update)
			protected.Delete("/saved-filters/{id}", savedFilterH.Delete)

			// Notifications (inbox)
			protected.Get("/notifications", notificationH.List)
			protected.Post("/notifications/{id}/read", notificationH.MarkRead)
			protected.Post("/notifications/read-all", notificationH.MarkAllRead)
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
