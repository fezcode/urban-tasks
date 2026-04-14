# Urban Tasks — Roadmap

## Data & Persistence
- [x] **Backend API + database** — Go + Chi + PostgreSQL, JWT auth, full CRUD REST API
- [ ] **Undo/redo** — reversible actions for task and project mutations
- [ ] **Data export/import** — JSON backup and restore

## Task Management
- [ ] **Subtasks / checklists** — break tasks into steps
- [x] **Task priorities** — high / medium / low with visual indicators
- [ ] **Recurring tasks** — daily, weekly, custom repeat schedules
- [ ] **Assignees / multi-user** — collaboration support
- [ ] **Drag-and-drop reordering** — manual sort within projects
- [ ] **Attachments and links** — files or URLs on tasks

## Views & Navigation
- [ ] **Calendar view** — month/week visualization of due dates
- [x] **Upcoming / This week filter** — tasks due in the next 7 days
- [x] **Archive** — separate completed tasks from active list
- [ ] **Dashboard improvements** — velocity tracking, trends, burndown

## UX Polish
- [ ] **Notifications / reminders** — browser notifications for due dates
- [x] **Keyboard shortcuts** — quick status toggle, navigation, task creation
- [ ] **Onboarding** — first-run guidance for new users
- [x] **Confirmation dialogs** — destructive actions require confirmation
- [ ] **PWA support** — service worker, offline mode, install prompt

## Technical
- [ ] **Tests** — unit and integration test coverage
- [ ] **Accessibility** — ARIA labels, full keyboard navigation, screen reader support
- [ ] **i18n** — internationalization and RTL layout support
- [x] **Code splitting** — lazy loading to reduce bundle size
