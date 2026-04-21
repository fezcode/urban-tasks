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
npm run dev -- --api-url http://localhost:8080
```

Or set `URBAN_TASKS_API` in your environment.

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

## Keys

- **Login** — Tab between fields, Enter to submit, Ctrl+R to toggle sign-in/register
- **Projects** — j/k or arrows, Enter to open, `l` logout, `q` quit
- **Tasks** — j/k move, Space toggle done, `n` new, `d` delete, `r` reload, `b`/Esc back

## Current scope

Login · project list · task list with status toggle · create · delete.
Coming: priority/tags filtering, due dates, subtasks, inbox, assignee pick.
