# Mobile Parity Backlog

Tasks for bringing the Expo RN mobile app to feature + style parity with the web version.

## Foundation
1. Audit web features & build parity inventory
2. Mirror web design tokens exactly into mobile theme
3. Build reusable UI primitives (Button, Chip, Card, Input, Field, Divider, SectionHeader)
4. Replace hand-drawn tab icons with a proper icon set (lucide-react-native)

## Task surface
5. Rebuild task list row to match web's TaskItem spacing and hierarchy
6. Full TaskDetail screen: markdown body, subtasks, links, tags, recurrence
7. Native date picker for start/due dates
8. Markdown rendering for task notes

## Views
9. Dashboard screen with counts, charts, and quick filters
10. Calendar view
11. Priority view (grouped by priority)
12. Tag filtering + tag chips everywhere

## Projects
13. Projects tab: edit, recolor, reorder, delete with task-cascade warning
14. Project drawer / sheet for quick switching

## Navigation & discovery
15. Search screen (command-palette analogue)

## Account
16. Profile: edit name, avatar seed, delete account
17. Data export / import
18. Onboarding flow for new accounts

## Platform quality
19. Offline queue + sync-on-reconnect
20. Pull-to-refresh + auto-refresh on focus everywhere
21. Haptics + micro-animations for state changes
22. Empty states with illustration matching web tone
23. Polish auth screens to web AuthPage visual standard
24. Install prompt / PWA-equivalent: native app icon, splash, adaptive theme
25. Accessibility pass: roles, labels, focus order, contrast

## Ops
26. Upgrade RN + screens to Expo 52's expected versions
27. EAS build config + TestFlight / internal-testing setup
