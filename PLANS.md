# Urban Tasks — Roadmap

## Data & Persistence
- [x] **Backend API + database** — Go + Chi + PostgreSQL, JWT auth, full CRUD REST API
- [x] **Undo/redo** — reversible actions for task updates (Ctrl+Z / Ctrl+Shift+Z)
- [x] **Data export/import** — JSON backup and restore

## Task Management
- [x] **Subtasks / checklists** — break tasks into steps
- [x] **Task priorities** — high / medium / low with visual indicators
- [x] **Recurring tasks** — daily, weekly, biweekly, monthly repeat
- [ ] **Assignees / multi-user** — collaboration support
- [x] **Drag-and-drop reordering** — manual sort within projects and sidebar
- [x] **Attachments and links** — files or URLs on tasks

## Views & Navigation
- [x] **Calendar view** — month/week visualization of due dates
- [x] **Upcoming / This week filter** — tasks due in the next 7 days
- [x] **Archive** — separate completed tasks from active list
- [ ] **Dashboard improvements** — velocity tracking, trends, burndown

## UX Polish
- [x] **Notifications / reminders** — browser notifications for due dates
- [x] **Keyboard shortcuts** — quick status toggle, navigation, task creation
- [x] **Onboarding** — first-run guidance for new users
- [x] **Confirmation dialogs** — destructive actions require confirmation
- [x] **Toast notifications** — non-blocking feedback for success/error actions (6-position)
- [x] **PWA support** — service worker, offline mode, install prompt

## Technical
- [~] **Tests** — backend unit tests for auth/priority; integration tests pending
- [ ] **Accessibility** — ARIA labels, full keyboard navigation, screen reader support
- [ ] **i18n** — internationalization and RTL layout support
- [x] **Code splitting** — lazy loading to reduce bundle size
