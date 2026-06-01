# Task Locations + OpenStreetMap Integration — Design

**Date:** 2026-06-01
**Status:** Approved (pending spec review)

## Summary

Add an optional **location** to tasks across all surfaces (web, mobile, TUI),
backed by OpenStreetMap. Users search an address or drag/drop a pin to set a
task's location; the task then shows a place chip, a map preview, and an "Open
in OpenStreetMap" link. Address search (geocoding) is proxied through the
backend to honor OSM's Nominatim usage policy.

## Goals

- Attach **one** optional location to a task: `{ name, lat, lon }`.
- Set it by **address search** (Nominatim) or by **dragging a pin** on a map
  (reverse-geocode to fill the label).
- Show a 📍 **chip** on task rows/cards when a location is set.
- Make the location **name searchable** via existing global full-text search.
- Provide an explicit **clear/remove** control.
- Keep everything **pure OpenStreetMap** — no Google Maps SDK, no API keys.

## Non-goals (this pass)

- "Use my current location" / GPS button.
- A map view plotting all tasks (the "map of everything" view).
- Routing / directions / distance / "near me".
- Multiple locations per task.

## Architecture

The repo shares one Go + Postgres backend across four clients (web React, Expo
mobile, Ink TUI). A location is a new optional field on a task, added the same
way prior fields were (`links` JSONB, `assignee_id`, `start_date`): migration →
`model.Task` field → repository SQL → service/handler passthrough → each client
type + UI.

### 1. Data model

A single **nullable JSONB `location`** column on `tasks`, mirroring how `links`
and `subtasks` are stored as JSONB structs.

```
Location {
  name: string    // human label from Nominatim, e.g. "Blue Bottle Coffee, 1 Main St…"
  lat:  float64
  lon:  float64
}
```

- `null`/absent → task has no location (the default). Existing tasks and the
  JSON export/import path round-trip unchanged because everything flows through
  `model.Task`.
- `name` is truncated with ellipsis in the chip, shown in full in the detail.

`model.Task` gains `Location *Location`. `CreateTaskRequest` and
`UpdateTaskRequest` gain an optional `Location` field. On update, an explicit
`null` clears the location.

### 2. Migration `014_location`

Up:
- `ALTER TABLE tasks ADD COLUMN location JSONB;`
- The existing `search_vector` is a **generated** column and cannot be
  `ALTER`ed in place. Drop `idx_tasks_search` and `search_vector`, then recreate
  the generated column adding the location name at weight `C` (below title `A` /
  body `B`), and recreate the GIN index:

  ```sql
  setweight(to_tsvector('simple', coalesce(title, '')),                'A') ||
  setweight(to_tsvector('simple', coalesce(body,  '')),                'B') ||
  setweight(to_tsvector('simple', coalesce(location->>'name', '')),    'C')
  ```

  `->>` and `to_tsvector('simple', …)` are immutable, so the generated column
  expression is valid.

Down:
- Restore the original title-A / body-B `search_vector` + index.
- `ALTER TABLE tasks DROP COLUMN location;`

### 3. Backend geocoding proxy

New `geocode` service + handler, registered under the protected route group:

- `GET /api/v1/geocode/search?q=<text>` → forward geocode (address → candidates)
- `GET /api/v1/geocode/reverse?lat=<>&lon=<>` → reverse geocode (pin → label)

The service wraps Nominatim and enforces OSM's usage policy:

- Fixed **`User-Agent`**: `urban-tasks/<version> (contact)`.
- **~1 req/sec throttle** to Nominatim (mutex + last-call timestamp — no new
  dependency).
- **In-memory TTL cache** (map + mutex, ~24h, size-capped) keyed by the
  normalized query so repeat lookups don't re-hit Nominatim.
- Nominatim **base URL from config** so it can be swapped for a self-hosted or
  commercial endpoint later.

Returns a slim list `[{ name, lat, lon }]`. Uses the standard-library HTTP
client; **no new Go dependencies**.

### 4. Web (`frontend/`) — full interactive

- Add deps: `leaflet`, `react-leaflet`, `@types/leaflet`.
- New `LocationField.tsx`:
  - Debounced address search box → `/geocode/search`, results dropdown.
  - Interactive Leaflet map (OSM tile layer + required attribution) with a
    **draggable marker**; dragging reverse-geocodes to refill the label.
  - **✕ remove** clears the location.
  - Slots into the metadata column of the existing `TaskDetail.tsx`.
- Display:
  - 📍 **chip** (place name) on `TaskItem.tsx` and in the task detail when a
    location is set.
  - "Open in OpenStreetMap" link →
    `https://www.openstreetmap.org/?mlat=<lat>&mlon=<lon>#map=16/<lat>/<lon>`.
- `api/client.ts`: add `location` to the task create/update payloads and add a
  `geocode` client (`search`, `reverse`).

### 5. Mobile (`mobile/`) — Leaflet-in-WebView

- Add dep: `react-native-webview` (Expo-supported). **No** `react-native-maps`,
  so no native Google Maps SDK / API keys, and the map stays pure OSM and
  consistent with web.
- `LocationField` renders a small Leaflet map inside a WebView; tap/drag drops
  the pin and posts coordinates back to React Native via `postMessage`. The
  search box hits the same backend `/geocode` endpoints.
- 📍 chip in `TaskRow` and the task view modal.
- `Task` type + create/update payloads gain `location`.

### 6. TUI (`tui/`) — text only

A terminal can't render a map, so:

- Detail screen shows `📍 <name>` plus an "Open in OpenStreetMap" URL line.
- Task form: a location row → type to search → choose from a results list
  (calls `/geocode/search`); a key clears the selection.
- Inline `📍 <name>` on the task list row (the chip equivalent).
- `Task` type + API payload gain `location`.

### 7. Search

Folding `location.name` into `search_vector` (weight `C`) is done entirely in
migration `014`. `service/search.go` needs **no change** — searching
"blue bottle" surfaces tasks pinned there, ranked below title/body matches.

## Data flow (set a location, web)

1. User types in the `LocationField` search box.
2. Debounced call → `GET /api/v1/geocode/search?q=…` → backend
   (throttle/cache) → Nominatim → `[{name, lat, lon}]`.
3. User picks a result **or** drags the marker (→ `/geocode/reverse` fills the
   label).
4. `location` is included in the task `PATCH`/`POST` payload.
5. Backend writes the JSONB column; the generated `search_vector` updates
   automatically.
6. Task list/detail render the 📍 chip and "Open in OpenStreetMap" link.

## Error handling

- Geocoding failures (Nominatim down, timeout, rate-limited): backend returns an
  empty result list with a non-fatal status; clients show "no results" / a
  toast, never block saving the task.
- A task can always be saved **without** a location.
- Invalid `lat`/`lon` on reverse requests → 400.
- Malformed/oversized `location` on task write → validated and rejected
  (lat ∈ [-90, 90], lon ∈ [-180, 180], `name` length-capped).

## Testing

- **Backend:** unit-test the geocode service throttle + cache (table-driven,
  with a stubbed Nominatim HTTP client); test `Location` round-trips through
  repository create/update/get; test that a location name appears in search
  results after the migration.
- **Web:** the `LocationField` search→select and marker-drag→reverse flows
  (mocked geocode client); chip renders only when a location is set.
- **Manual:** set/clear a location on each surface; confirm the OSM link opens
  the right pin; confirm search finds a task by its place name.

## Build sequence

1. Migration `014_location` (+ down).
2. `model.Task` + request DTOs + repository SQL (`taskColumns`, create, update,
   scan).
3. Geocode service + handler + routes.
4. Web: api client, `LocationField`, `TaskDetail`, `TaskItem` chip.
5. Mobile: api client, WebView `LocationField`, `TaskRow`/modal chip.
6. TUI: api type, task-form location row, task-detail display, list chip.
7. Tests + manual pass on each surface.

## Dependencies added

- Backend: none.
- Web: `leaflet`, `react-leaflet`, `@types/leaflet`.
- Mobile: `react-native-webview`.
- TUI: none.
