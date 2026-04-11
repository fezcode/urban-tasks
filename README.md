# Urban Tasks

A clean, minimal personal task manager with projects, burndown charts, and light/dark themes.

## Features

- **Tasks** — Create, complete, and manage tasks with status cycling (to-do, active, done)
- **Projects** — Organize tasks into color-coded projects with unique geometric icons
- **Dashboard** — Burndown chart, daily velocity, status distribution, and per-project progress
- **Light / Dark theme** — Toggle between warm light and dark modes, persisted to localStorage
- **LocalStorage persistence** — All data saved automatically, no backend needed
- **GitHub Pages ready** — Ships with a deploy workflow

## Tech Stack

- React 19
- TypeScript
- Tailwind CSS
- Vite
- Recharts
- date-fns
- Lucide Icons

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

## Deploy

Push to `main` and the included GitHub Actions workflow (`.github/workflows/deploy.yml`) will build and deploy to GitHub Pages automatically.

Make sure **Settings > Pages > Source** is set to **GitHub Actions** in your repo.

## License

MIT
