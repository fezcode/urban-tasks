# Urban Tasks — Roadmap

## Data & Persistence
- [x] **Backend API + database** — Go + Chi + PostgreSQL, JWT auth, full CRUD REST API
- [x] **Undo/redo** — reversible actions for task updates (Ctrl+Z / Ctrl+Shift+Z)
- [x] **Data export/import** — JSON backup and restore

## Task Management
- [x] **Subtasks / checklists** — break tasks into steps
- [x] **Task priorities** — high / medium / low with visual indicators
- [x] **Recurring tasks** — daily, weekly, biweekly, monthly repeat
- [x] **Assignees / multi-user** — project membership, invitations, per-task assignee with notification on assign
- [x] **Drag-and-drop reordering** — manual sort within projects and sidebar
- [x] **Attachments and links** — files or URLs on tasks

## Views & Navigation
- [x] **Calendar view** — month/week visualization of due dates
- [x] **Upcoming / This week filter** — tasks due in the next 7 days
- [x] **Archive** — separate completed tasks from active list
- [x] **Dashboard improvements** — velocity tracking, trends, burndown
- [x] **Priority View** — High/Medium/Low filter chips in the main toolbar, composes with status/tag/date filters

## UX Polish
- [x] **Notifications / reminders** — browser notifications for due dates
- [x] **Keyboard shortcuts** — quick status toggle, navigation, task creation
- [x] **Onboarding** — first-run guidance for new users
- [x] **Confirmation dialogs** — destructive actions require confirmation
- [x] **Toast notifications** — non-blocking feedback for success/error actions (6-position)
- [x] **PWA support** — service worker, offline mode, install prompt

## Technical
- [~] **Tests** — backend unit tests for auth/priority/recurrence; integration tests pending
- [x] **Accessibility** — ARIA labels, full keyboard navigation, screen reader support
- [ ] **i18n** — internationalization and RTL layout support
- [x] **Code splitting** — lazy loading to reduce bundle size

## Security
- [ ] **Encryption** - we need to implement a secure way to store passwords and user data

## Monetization
- [ ] **Payments** — Lemon Squeezy or Paddle (merchant-of-record, TR-seller friendly); checkout, webhooks, invoices, receipts
- [ ] **Subscription plans** — tiers, gating, upgrade/downgrade, trials, cancellation, billing portal

### Tier plan

| Tier | Price | Projects | Collaboration | Views | Sync |
|------|-------|----------|---------------|-------|------|
| **Free** | $0 | 1 owned (can join projects they're invited to) | invitee only — cannot send invitations or assign tasks | list, calendar | cloud |
| **Pro** | $4/mo, $40/yr | unlimited | full — invite members, assign tasks, manage roles | list, calendar, dashboard, archive | cloud |

- 14-day Pro trial on signup, no card required
- Annual billing = 2 months free
- Downgrades retain read-only access to Pro-only data until re-upgrade
- Lifetime deal for early adopters (first 500) at $99 one-time Pro
- Team tier split off later if enterprise demand emerges (SSO, audit log, per-seat billing)

## Platforms
- [~] **Mobile app** — iOS + Android (Expo + React Native, expo-router), scaffolded under `mobile/` with shared theme tokens. Pending: offline-first sync, push notifications, biometric unlock, share-sheet capture.
- [~] **TUI** — terminal UI under `tui/`, built with React + Ink (same stack Claude Code uses). Login, project list, task list, task detail, full create/edit form, search, filters. Pending:
  - [x] **Task detail view** — body, priority, due/start, tags, links, subtasks, recurrence
  - [x] **Edit fields inline** — full form screen for title/body/priority/status/dates/tags/recurrence (used for both create and edit)
  - [x] **Subtask view** — toggle, add (`a`), delete (`D`) inside the detail screen
  - [x] **Filters** — `f`/`F` cycles status chip, `p`/`P` cycles priority chip
  - [x] **Search** — `/` filters on title, body, tags
  - [x] **Inbox screen** — invitations (accept/reject) + notifications (mark read / mark all read)
  - [x] **Assignee picker** — `@` in detail opens a member list, Enter assigns (or choose "unassign")
  - [x] **Project switcher** — `<` / `>` (or `[` / `]`) cycles projects from the task list
  - [x] **Create project** — `N` opens name+color create flow; `d` deletes selected
  - [x] **Color / theme** — `NO_COLOR` respected via chalk; task list header borders/title use project accent color
  - [x] **Global shortcuts** — `?` help overlay, `q` quits from projects/task list/detail/inbox
  - [x] **Markdown description** — custom Ink renderer for headings, lists, code fences, blockquotes, inline bold/italic/code/links

## Collaboration
- [ ] **Comments + @mentions** — threaded comments on tasks, mention users to trigger notifications. Reuses existing notification pipeline.
- [ ] **Task watchers** — subscribe without being assignee; get notified on status/assignee/due-date changes.
- [ ] **Roles & permissions** — owner/admin/member split; gate delete/invite/billing on role.

## Search & Organization
- [ ] **Global search** — full-text across titles, descriptions, comments via Postgres `tsvector`+GIN. Cmd+K command palette on web.
- [ ] **Saved filters / smart lists** — named views in sidebar (e.g., "My high-priority due this week").
- [ ] **Bulk actions** — multi-select tasks to assign/tag/move/complete/delete in one shot.

## Productivity
- [ ] **Natural-language quick add** — parse "fix login bug tomorrow 3pm #frontend !high" into structured fields (chrono-node).
- [ ] **Templates** — reusable project/task-set templates (e.g., "sprint kickoff" seeds N tasks).
- [ ] **Time tracking** — per-task start/stop timer, daily totals, estimated vs actual.

## Integrations
- [ ] **Personal API tokens** — user-issued PATs with scopes; public REST docs.
- [ ] **Outbound webhooks** — fire on task/project events; prerequisite for Zapier-style integrations.
- [ ] **ICS calendar feed** — per-user subscribe URL exposing tasks with due dates to Google/Apple Calendar.
- [ ] **GitHub/GitLab linking** — attach issue URLs, auto-pull title/status, optional two-way close sync.
- [ ] **Email dispatch** — transactional email (Resend or SMTP) for invitations, assignments, due-date reminders.

## AI
- [ ] **Task breakdown** — "break into subtasks" button, one Claude call, user accepts/edits results.
- [ ] **Weekly summary** — Claude-generated recap of the week's task activity on the dashboard.
- [ ] **Smart prioritization** — suggest priority + due date at create time from title/description.

## In progress
- [x] **Specific task view** — focused task modal (web + mobile) with markdown description, metadata, and share-link button. Web supports `?task=<id>` deep links.
- [x] **Assignee display on mobile** — assignee chip in `TaskRow` list and `TaskViewModal`, backed by per-project members cache built from tasks with `assigneeId`
- [x] **Notification renderer for `task_assigned`** — human copy ("X assigned you …") + click opens the task; backend payload now includes assignerName/projectName