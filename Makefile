.PHONY: dev dev-be dev-fe build build-be build-fe docker-up docker-down migrate lint test

# --- Development ---

dev-be:
	cd backend && go run ./cmd/server

dev-fe:
	cd frontend && npm run dev

dev: ## Run both backend and frontend (requires two terminals or use docker)
	@echo "Run 'make dev-be' and 'make dev-fe' in separate terminals"
	@echo "Or use 'make docker-up' to start everything with Docker"

# --- Build ---

build-be:
	cd backend && CGO_ENABLED=0 go build -ldflags="-s -w" -o ../dist/server ./cmd/server

build-fe:
	cd frontend && npm run build

build: build-be build-fe

# --- Docker ---

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

# --- Database ---

migrate:
	cd backend && go run ./cmd/server migrate

# --- Quality ---

lint-be:
	cd backend && go vet ./...

lint-fe:
	cd frontend && npm run lint

lint: lint-be lint-fe

test-be:
	cd backend && go test ./... -v

test: test-be
