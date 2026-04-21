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

| Tier | Price | Projects | Sync | Collaboration | Views | Integrations |
|------|-------|----------|------|---------------|-------|--------------|
| **Free** | $0 | 1 | local only | — | list, calendar | export/import JSON |
| **Pro** | $4/mo, $40/yr | unlimited | cloud sync, multi-device | — | list, calendar, dashboard, archive | attachments, recurring tasks, priority support |
| **Team** | $9/user/mo, $90/user/yr | unlimited | cloud sync | assignees, shared projects, roles, audit log | Pro + team dashboard | SSO, webhook hooks, priority support |

- 14-day Pro trial on signup, no card required
- Annual billing = 2 months free
- Team min 2 seats, bulk seats via billing portal
- Downgrades retain read-only access to Pro-only data until re-upgrade
- Lifetime deal for early adopters (first 500) at $99 one-time Pro

## Platforms
- [~] **Mobile app** — iOS + Android (Expo + React Native, expo-router), scaffolded under `mobile/` with shared theme tokens. Pending: offline-first sync, push notifications, biometric unlock, share-sheet capture.

## In progress
- [x] **Specific task view** — focused task modal (web + mobile) with markdown description, metadata, and share-link button. Web supports `?task=<id>` deep links.
- [x] **Assignee display on mobile** — assignee chip in `TaskRow` list and `TaskViewModal`, backed by per-project members cache built from tasks with `assigneeId`
- [x] **Notification renderer for `task_assigned`** — human copy ("X assigned you …") + click opens the task; backend payload now includes assignerName/projectName