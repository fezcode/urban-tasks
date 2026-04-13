.PHONY: dev dev-be dev-fe build build-be build-fe docker-up docker-down prod-up prod-down prod-logs deploy lint test

# --- Development ---

dev-be:
	cd backend && go run ./cmd/server

dev-fe:
	cd frontend && npm run dev

dev:
	@echo "Run 'make dev-be' and 'make dev-fe' in separate terminals"
	@echo "Or use 'make docker-up' to start everything with Docker"

# --- Build ---

build-be:
	cd backend && CGO_ENABLED=0 go build -ldflags="-s -w" -o ../dist/server ./cmd/server

build-fe:
	cd frontend && npm run build

build: build-be build-fe

# --- Docker (dev) ---

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

# --- Production ---

prod-up:
	docker compose -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.prod.yml down

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

prod-backup:
	docker compose -f docker-compose.prod.yml exec postgres pg_dump -Fc -U $${POSTGRES_USER} $${POSTGRES_DB} > backup_$$(date +%Y%m%d).dump

deploy:
	./deploy/deploy.sh

# --- Quality ---

lint-be:
	cd backend && go vet ./...

lint-fe:
	cd frontend && npm run lint

lint: lint-be lint-fe

test-be:
	cd backend && go test ./... -v

test: test-be
