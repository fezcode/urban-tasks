# Urban Tasks

A personal task manager with projects, a velocity dashboard, recurring tasks, calendar view,
undo/redo, offline PWA support, and a warm editorial aesthetic. Go + PostgreSQL backend,
React 19 + TypeScript + Vite frontend.

## Features

### Tasks
- Status cycling (to-do → in-progress → done) and priority (low / medium / high)
- Subtasks, tags, attachments/links, recurring schedules (daily / weekly / biweekly / monthly)
- Drag-and-drop reordering within a project, manual sidebar order
- Undo / redo for task edits (Ctrl+Z / Ctrl+Shift+Z)
- Assignees: pick any project member; the assignee gets a notification when assigned

### Views
- **Tasks** — grouped by project or flat single-project view
- **Dashboard** — burndown, 7-day velocity delta, streaks, overdue count, upcoming mini-bars, priority mix, per-project breakdown
- **Calendar** — month grid with priority-colored dots and a side panel per day
- **Archive** — completed tasks separated from active work

### UX
- Light / dark theme, six-position toast system, confirmation dialogs
- Browser notifications for due-today / overdue tasks
- Command palette (Ctrl/⌘+K), keyboard shortcuts, onboarding flow
- PWA: installable, service-worker cached, offline-capable
- Accessible: ARIA labels, skip link, dialog roles, keyboard-first task list

### Collaboration
- Shared projects with admin/member roles
- Email invitations (accept / reject), in-app invitation inbox
- Notifications: invitation events, task assignments

### Data
- JWT auth (access + refresh)
- Full JSON export / import

## Tech Stack

**Backend:** Go 1.25, Chi, pgx, PostgreSQL, golang-migrate, JWT
**Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Recharts, date-fns, Lucide, Fraunces + Inter

## Getting Started

### Prerequisites
- Go 1.25+
- Node 22+
- PostgreSQL 15+ (or Docker)

### Backend

```bash
cd backend
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/urban_tasks?sslmode=disable"
export JWT_SECRET="change-me-in-production"
export ENVIRONMENT="development"
go run ./cmd/server
```

Migrations run automatically on startup. Dev mode accepts any `localhost` / `127.0.0.1` origin.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api/*` to the Go server.

## Docker

Both services ship with a Dockerfile:

```bash
docker build -t urban-tasks-backend ./backend
docker build -t urban-tasks-frontend ./frontend
```

The frontend image builds the SPA and serves it via nginx with a single-page fallback,
long-cache for hashed assets, and no-cache on `sw.js` / `manifest.webmanifest`.

## Tests

```bash
cd backend && go test ./...
```

## Deploy

Self‑host the full stack (Caddy + Go backend + Postgres + daily backups) on a
single server with Docker Compose — see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

Quick version:

```bash
git clone https://github.com/fezcode/urban-tasks ~/urban-tasks && cd ~/urban-tasks
# create .env (DOMAIN + secrets — see the guide)
docker compose -f docker-compose.prod.yml up -d --build
```

## License

MIT

---

![](./quote.jpeg)
