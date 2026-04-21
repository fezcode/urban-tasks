# Urban Tasks TUI

Terminal UI for Urban Tasks. Built with **React + Ink + TypeScript** — the same
rendering stack Claude Code uses for its CLI.

## Install

```bash
cd tui
npm install
```

## Run (dev)

```bash
npm run dev
# or with custom backend
npm run dev -- --api-url http://localhost:8080
```

Flags passed to `npm run` need `--` before them (that's an npm convention, not a
quirk of this tool). Or set `URBAN_TASKS_API` in your environment.

## Build

```bash
npm run build
npm start
```

## Install globally

```bash
npm run build
npm link
urban-tasks
```

## Session

Credentials are stored at `~/.urban-tasks/session.json` (mode 0600). Clear with:

```bash
urban-tasks --logout
```

## Keybindings

### Login / register
- Tab — next field
- Enter — submit
- Ctrl+R — toggle sign-in ↔ register

### Projects
- j / k or ↑ / ↓ — move
- Enter — open project
- `N` — new project (name + color)
- `d` — delete highlighted project
- `i` — inbox
- `r` — reload
- `l` — logout · `q` — quit

### Inbox
- j / k — move
- `a` or `y` — accept invitation
- `x` or `n` — reject invitation
- `m` or Enter — mark notification read
- `A` — mark all notifications read
- `r` — reload · `b` / Esc — back

### Task list
- j / k — move
- Enter — open task detail
- `e` — edit task (full form)
- Space — toggle done
- `n` — new task (full form)
- `d` — delete task
- `/` — search title, body, tags
- `f` / `F` — cycle status filter (forward / back)
- `p` / `P` — cycle priority filter
- Esc — clear active filters; second Esc goes back
- `r` — reload · `b` — back

### Task detail
- Space — toggle done
- `i` — toggle in-progress
- `s` — cycle status (todo → in-progress → done)
- `e` — edit task
- `a` — add subtask · `D` — delete highlighted subtask · `t` — toggle subtask
- j / k — move between subtasks
- `r` — reload · `b` / Esc — back

### Task form (new / edit)
- Tab or ↑ / ↓ — move between fields
- ← / → or h / l — cycle enum options (priority, status, recurrence)
- Enter — advance field (or submit on last field)
- Ctrl+S — save from any field
- Esc — cancel

## Stack

- [Ink](https://github.com/vadimdemedes/ink) — React for CLIs (Yoga layout)
- [ink-text-input](https://github.com/vadimdemedes/ink-text-input)
- [ink-select-input](https://github.com/vadimdemedes/ink-select-input)
- [ink-spinner](https://github.com/vadimdemedes/ink-spinner)
- [meow](https://github.com/sindresorhus/meow) — CLI arg parsing
