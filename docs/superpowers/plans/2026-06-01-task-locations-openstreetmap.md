# Task Locations + OpenStreetMap Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users attach one optional OpenStreetMap location (`{name, lat, lon}`) to a task on web, mobile, and TUI — set by address search or pin-drag, shown as a 📍 chip + "Open in OpenStreetMap" link, searchable, and clearable.

**Architecture:** A nullable JSONB `location` column on `tasks` (same pattern as `links`/`subtasks`), threaded through `model.Task` → repository SQL → service/handler. A backend geocoding proxy wraps OSM Nominatim (User-Agent, ~1 req/s throttle, in-memory TTL cache). Web uses Leaflet, mobile uses Leaflet-in-WebView, TUI is text-only. Location name folds into the existing generated `search_vector`.

**Tech Stack:** Go + Chi + pgx/Postgres (golang-migrate); React + TS + Tailwind + Leaflet (web); Expo / React Native + react-native-webview (mobile); React + Ink (TUI).

---

## Conventions (read once)

- **Windows + PowerShell**: chain commands with `;`, not `&&`.
- **Commits**: no `Co-Authored-By` trailer (project convention).
- Backend decoder uses `DisallowUnknownFields()` — every new JSON field a client sends MUST exist on the matching request DTO or the request 400s.
- Handlers wrap responses in `{ "data": ... }`; the web client unwraps `json.data`.
- Run backend from `backend/`: `go build ./...`, `go test ./...`, `go vet ./...`.
- Mobile typecheck: run the local TypeScript binary (per project convention), not `npx tsc`.

## File Structure

**Backend**
- Create `backend/migrations/014_location.up.sql` / `.down.sql` — add JSONB column, rebuild `search_vector`.
- Modify `backend/internal/model/models.go` — `Location` struct, `Task.Location`, DTO fields, validation helper.
- Modify `backend/internal/repository/task.go` — `taskColumns`, Create, Update, GetByID, `scanTasks`.
- Modify `backend/internal/service/task.go` — set/clear location in Create + Update.
- Create `backend/internal/service/geocode.go` — Nominatim wrapper (throttle + cache).
- Create `backend/internal/service/geocode_test.go` — unit tests (stubbed transport).
- Create `backend/internal/handler/geocode.go` — `/geocode/search` + `/geocode/reverse`.
- Modify `backend/internal/config/config.go` — `NominatimURL` config.
- Modify `backend/cmd/server/main.go` — wire geocode service/handler + routes.

**Web** (`frontend/`)
- Modify `frontend/package.json` — add `leaflet`, `react-leaflet`, `@types/leaflet`.
- Modify `frontend/src/context/types.ts` — `Location` type + `Task.location`.
- Modify `frontend/src/api/client.ts` — `geocode` client + `location` in create payload.
- Create `frontend/src/components/LocationField.tsx` — search + interactive map + clear.
- Modify `frontend/src/components/TaskDetail.tsx` — render `LocationField`, `setLocation` dispatch.
- Modify `frontend/src/components/TaskItem.tsx` — 📍 chip.

**Mobile** (`mobile/`)
- Modify `mobile/package.json` — add `react-native-webview`.
- Modify `mobile/src/api/client.ts` — `Location` type, `Task.location`, `geocode` client, create payload.
- Create `mobile/src/components/LocationField.tsx` — WebView Leaflet + search + clear.
- Modify `mobile/app/(app)/tasks.tsx` — render `LocationField` in edit; 📍 chip in row + view modal.

**TUI** (`tui/`)
- Modify `tui/src/api.ts` — `Location` type, `Task.location`, `geocode` client, payload fields.
- Modify `tui/src/screens/task-form.tsx` — location search row + clear key.
- Modify `tui/src/screens/task-detail.tsx` — `📍 name` + OSM URL line.
- Modify `tui/src/screens/tasks.tsx` — inline `📍 name` on list row.

---

## Task 1: Migration `014_location`

**Files:**
- Create: `backend/migrations/014_location.up.sql`
- Create: `backend/migrations/014_location.down.sql`

- [ ] **Step 1: Write the up migration**

`backend/migrations/014_location.up.sql`:

```sql
-- Add an optional location to tasks: { name, lat, lon } as JSONB.
ALTER TABLE tasks ADD COLUMN location JSONB;

-- search_vector is a generated column and cannot be ALTERed in place.
-- Rebuild it to also index the location name (weight C, below title/body).
DROP INDEX IF EXISTS idx_tasks_search;
ALTER TABLE tasks DROP COLUMN search_vector;

ALTER TABLE tasks ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(title, '')),               'A') ||
        setweight(to_tsvector('simple', coalesce(body,  '')),               'B') ||
        setweight(to_tsvector('simple', coalesce(location->>'name', '')),   'C')
    ) STORED;

CREATE INDEX idx_tasks_search ON tasks USING GIN (search_vector);
```

- [ ] **Step 2: Write the down migration**

`backend/migrations/014_location.down.sql`:

```sql
-- Restore the original title-A / body-B search_vector and drop location.
DROP INDEX IF EXISTS idx_tasks_search;
ALTER TABLE tasks DROP COLUMN search_vector;

ALTER TABLE tasks ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(body,  '')), 'B')
    ) STORED;

CREATE INDEX idx_tasks_search ON tasks USING GIN (search_vector);

ALTER TABLE tasks DROP COLUMN location;
```

- [ ] **Step 3: Apply migration by starting the stack**

Run (PowerShell, repo root): `docker compose up -d db ; docker compose up backend`
Expected: backend logs `"migrations complete" version=14 dirty=false`. (Or run the DB and `cd backend ; go run ./cmd/server` against it.)

- [ ] **Step 4: Verify the schema**

Run: `docker compose exec db psql -U postgres -d urban_tasks -c "\d tasks"` (adjust DB name/user from `docker-compose.yml`/config if different).
Expected: a `location | jsonb` column and a `search_vector` generated column; `idx_tasks_search` present.

- [ ] **Step 5: Commit**

```
git add backend/migrations/014_location.up.sql backend/migrations/014_location.down.sql
git commit -m "feat(location): migration 014 — tasks.location jsonb + search_vector"
```

---

## Task 2: Backend model — `Location`, task field, DTOs, validation

**Files:**
- Modify: `backend/internal/model/models.go`
- Test: `backend/internal/model/location_test.go` (create)

- [ ] **Step 1: Write the failing validation test**

`backend/internal/model/location_test.go`:

```go
package model

import "testing"

func TestSanitizeLocation(t *testing.T) {
	long := make([]byte, 300)
	for i := range long {
		long[i] = 'a'
	}

	cases := []struct {
		name    string
		in      *Location
		wantNil bool
		wantLen int // expected len of Name when not nil
	}{
		{"nil stays nil", nil, true, 0},
		{"valid passes", &Location{Name: "Blue Bottle", Lat: 37.8, Lon: -122.2}, false, 11},
		{"lat out of range -> nil", &Location{Name: "x", Lat: 91, Lon: 0}, true, 0},
		{"lon out of range -> nil", &Location{Name: "x", Lat: 0, Lon: 181}, true, 0},
		{"empty name -> nil", &Location{Name: "  ", Lat: 1, Lon: 1}, true, 0},
		{"name trimmed + capped", &Location{Name: "  " + string(long) + "  ", Lat: 1, Lon: 1}, false, 256},
	}
	for _, c := range cases {
		got := SanitizeLocation(c.in)
		if c.wantNil {
			if got != nil {
				t.Errorf("%s: want nil, got %+v", c.name, got)
			}
			continue
		}
		if got == nil {
			t.Fatalf("%s: want non-nil", c.name)
		}
		if len([]rune(got.Name)) != c.wantLen {
			t.Errorf("%s: name len = %d, want %d", c.name, len([]rune(got.Name)), c.wantLen)
		}
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend ; go test ./internal/model/ -run TestSanitizeLocation -v`
Expected: FAIL — `undefined: SanitizeLocation` (and `Location`).

- [ ] **Step 3: Add the `Location` type, task field, DTO fields, and `SanitizeLocation`**

In `backend/internal/model/models.go`, add `"strings"` to imports, then add near `TaskLink`:

```go
// Location is an optional place attached to a task, sourced from OpenStreetMap.
type Location struct {
	Name string  `json:"name"`
	Lat  float64 `json:"lat"`
	Lon  float64 `json:"lon"`
}

// SanitizeLocation trims/caps the name and validates coordinates.
// Returns nil for invalid or empty input (treated as "no location").
func SanitizeLocation(l *Location) *Location {
	if l == nil {
		return nil
	}
	name := strings.TrimSpace(l.Name)
	if name == "" {
		return nil
	}
	if l.Lat < -90 || l.Lat > 90 || l.Lon < -180 || l.Lon > 180 {
		return nil
	}
	if r := []rune(name); len(r) > 256 {
		name = string(r[:256])
	}
	return &Location{Name: name, Lat: l.Lat, Lon: l.Lon}
}
```

Add to the `Task` struct (after `AssigneeID`):

```go
	Location *Location `json:"location,omitempty"`
```

Add to `CreateTaskRequest` (after `AssigneeID`):

```go
	Location *Location `json:"location,omitempty"`
```

Add `"encoding/json"` to imports and add to `UpdateTaskRequest` (after `AssigneeID`). Raw JSON lets the service distinguish absent (nil) from explicit `null` (clear) from an object (set):

```go
	Location json.RawMessage `json:"location,omitempty"`
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend ; go test ./internal/model/ -run TestSanitizeLocation -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add backend/internal/model/models.go backend/internal/model/location_test.go
git commit -m "feat(location): Location model, task field, request DTOs, sanitizer"
```

---

## Task 3: Repository — persist + scan `location`

**Files:**
- Modify: `backend/internal/repository/task.go`

- [ ] **Step 1: Add `location` to the column list**

In `backend/internal/repository/task.go`, append `, t.location` to `taskColumns`:

```go
const taskColumns = `t.id, t.user_id, t.project_id, t.title, t.body, t.status, t.priority, t.tags, t.links, t.subtasks, t.start_date, t.due_date, t.recurrence, t.position, t.created_at, t.updated_at, t.completed_at, t.created_by, t.updated_by, t.assignee_id, t.location`
```

- [ ] **Step 2: Insert `location` in `Create`**

Add the column + a `$21` placeholder and bind `t.Location` (pgx JSONB-encodes the struct; a nil pointer becomes SQL NULL, exactly like `links`/`subtasks` are JSONB-encoded):

```go
func (r *TaskRepo) Create(ctx context.Context, t *model.Task) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO tasks (id, user_id, project_id, title, body, status, priority, tags, links, subtasks, start_date, due_date, recurrence, position, created_at, updated_at, completed_at, created_by, updated_by, assignee_id, location)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
		t.ID, t.UserID, t.ProjectID, t.Title, t.Body, t.Status, t.Priority, t.Tags, t.Links, t.Subtasks, dateTo(t.StartDate), dateTo(t.DueDate), t.Recurrence, t.Position, t.CreatedAt, t.UpdatedAt, t.CompletedAt, t.CreatedBy, t.UpdatedBy, t.AssigneeID, t.Location,
	)
	if err != nil {
		return fmt.Errorf("creating task: %w", err)
	}
	return nil
}
```

- [ ] **Step 3: Set `location` in `Update`**

Renumber the trailing placeholders: `location = $16` and `WHERE id = $17`:

```go
func (r *TaskRepo) Update(ctx context.Context, t *model.Task) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE tasks SET project_id = $1, title = $2, body = $3, status = $4, priority = $5, tags = $6, links = $7, subtasks = $8,
		 start_date = $9, due_date = $10, recurrence = $11, position = $12, updated_at = $13, completed_at = $14, updated_by = $15, location = $16, assignee_id = $17
		 WHERE id = $18`,
		t.ProjectID, t.Title, t.Body, t.Status, t.Priority, t.Tags, t.Links, t.Subtasks, dateTo(t.StartDate), dateTo(t.DueDate), t.Recurrence, t.Position, t.UpdatedAt, t.CompletedAt, t.UpdatedBy, t.Location, t.AssigneeID, t.ID,
	)
	if err != nil {
		return fmt.Errorf("updating task: %w", err)
	}
	return nil
}
```

- [ ] **Step 4: Scan `location` in `GetByID`**

Add `&t.Location` as the final scan target (matches the new column order):

```go
	).Scan(&t.ID, &t.UserID, &t.ProjectID, &t.Title, &t.Body, &t.Status, &t.Priority, &t.Tags, &t.Links, &t.Subtasks, &start, &due, &t.Recurrence, &t.Position, &t.CreatedAt, &t.UpdatedAt, &t.CompletedAt, &t.CreatedBy, &t.UpdatedBy, &t.AssigneeID, &t.Location)
```

- [ ] **Step 5: Scan `location` in `scanTasks`**

Add `&t.Location` as the final scan target in the `rows.Scan(...)` call:

```go
		if err := rows.Scan(
			&t.ID, &t.UserID, &t.ProjectID, &t.Title, &t.Body, &t.Status, &t.Priority,
			&t.Tags, &t.Links, &t.Subtasks, &start, &due, &t.Recurrence, &t.Position, &t.CreatedAt, &t.UpdatedAt, &t.CompletedAt, &t.CreatedBy, &t.UpdatedBy, &t.AssigneeID, &t.Location,
		); err != nil {
			return nil, fmt.Errorf("scanning task: %w", err)
		}
```

- [ ] **Step 6: Verify it compiles**

Run: `cd backend ; go build ./...`
Expected: no errors.

- [ ] **Step 7: Commit**

```
git add backend/internal/repository/task.go
git commit -m "feat(location): persist and scan tasks.location"
```

---

## Task 4: Service — apply set/clear semantics

**Files:**
- Modify: `backend/internal/service/task.go`

- [ ] **Step 1: Set location on Create**

In `backend/internal/service/task.go`, in `Create`, after `assignee, _, err := s.resolveAssignee(...)` and before building `t := &model.Task{...}`, the task literal gains a sanitized location. Add this field inside the `&model.Task{...}` literal (after `AssigneeID: assignee,`):

```go
		Location: model.SanitizeLocation(req.Location),
```

- [ ] **Step 2: Apply absent/null/set semantics on Update**

In `Update`, after the `req.Recurrence` block and before the `req.ProjectID` block, add. `json.RawMessage` is nil when the field was omitted, `"null"` when the client sent `null` (clear), otherwise an object to set:

```go
	if req.Location != nil {
		trimmed := strings.TrimSpace(string(req.Location))
		if trimmed == "null" {
			t.Location = nil
		} else {
			var loc model.Location
			if err := json.Unmarshal(req.Location, &loc); err == nil {
				t.Location = model.SanitizeLocation(&loc)
			}
		}
	}
```

- [ ] **Step 3: Add imports**

Ensure `backend/internal/service/task.go` imports `"encoding/json"` and `"strings"` (alongside existing imports).

- [ ] **Step 4: Verify build + existing tests**

Run: `cd backend ; go build ./... ; go test ./internal/service/ -v`
Expected: build OK; existing service tests still PASS.

- [ ] **Step 5: Commit**

```
git add backend/internal/service/task.go
git commit -m "feat(location): set on create, set/clear on update"
```

---

## Task 5: Config — Nominatim base URL

**Files:**
- Modify: `backend/internal/config/config.go`

- [ ] **Step 1: Read the config file to match its pattern**

Run: open `backend/internal/config/config.go`. Note the `Config` struct fields and how each is loaded (e.g. a `getEnv(key, default)` helper).

- [ ] **Step 2: Add the field + default**

Add to the `Config` struct:

```go
	NominatimURL string
```

In the loader (where other fields are populated), add — default to the public endpoint, overridable via env:

```go
	NominatimURL: getEnv("NOMINATIM_URL", "https://nominatim.openstreetmap.org"),
```

(If the file uses a different env-helper name than `getEnv`, use that helper instead — match the surrounding lines exactly.)

- [ ] **Step 3: Verify build**

Run: `cd backend ; go build ./...`
Expected: no errors.

- [ ] **Step 4: Commit**

```
git add backend/internal/config/config.go
git commit -m "feat(location): NOMINATIM_URL config"
```

---

## Task 6: Geocode service (throttle + cache) — TDD

**Files:**
- Create: `backend/internal/service/geocode.go`
- Test: `backend/internal/service/geocode_test.go`

- [ ] **Step 1: Write the failing test**

`backend/internal/service/geocode_test.go`:

```go
package service

import (
	"context"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
)

// roundTripFunc lets us stub the HTTP transport.
type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func jsonResp(body string) *http.Response {
	return &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     make(http.Header),
	}
}

func TestGeocodeSearchParsesAndCaches(t *testing.T) {
	var calls int32
	body := `[{"display_name":"Blue Bottle Coffee, 1 Main St","lat":"37.8","lon":"-122.2"}]`
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		atomic.AddInt32(&calls, 1)
		if r.Header.Get("User-Agent") == "" {
			t.Error("missing User-Agent")
		}
		return jsonResp(body), nil
	})}
	svc := NewGeocodeService("https://nominatim.example", "urban-tasks-test/1.0", client)

	got, err := svc.Search(context.Background(), "blue bottle")
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if len(got) != 1 || got[0].Name != "Blue Bottle Coffee, 1 Main St" {
		t.Fatalf("unexpected result: %+v", got)
	}
	if got[0].Lat != 37.8 || got[0].Lon != -122.2 {
		t.Fatalf("bad coords: %+v", got[0])
	}

	// Second identical query is served from cache (no second HTTP call).
	if _, err := svc.Search(context.Background(), "blue bottle"); err != nil {
		t.Fatalf("search 2: %v", err)
	}
	if c := atomic.LoadInt32(&calls); c != 1 {
		t.Fatalf("expected 1 upstream call (cached), got %d", c)
	}
}

func TestGeocodeSearchEmptyQuery(t *testing.T) {
	svc := NewGeocodeService("https://x", "ua", http.DefaultClient)
	got, err := svc.Search(context.Background(), "   ")
	if err != nil || len(got) != 0 {
		t.Fatalf("empty query: got %v err %v", got, err)
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend ; go test ./internal/service/ -run TestGeocode -v`
Expected: FAIL — `undefined: NewGeocodeService`.

- [ ] **Step 3: Implement the geocode service**

`backend/internal/service/geocode.go`:

```go
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"urban-tasks/internal/model"
)

// GeocodeService wraps OSM Nominatim with a User-Agent, a ~1 req/s throttle,
// and an in-memory TTL cache, per OSM's usage policy.
type GeocodeService struct {
	baseURL   string
	userAgent string
	client    *http.Client

	throttleMu sync.Mutex
	lastCall   time.Time
	minGap     time.Duration

	cacheMu sync.Mutex
	cache   map[string]cacheEntry
	ttl     time.Duration
	maxKeys int
}

type cacheEntry struct {
	results []model.Location
	expires time.Time
}

func NewGeocodeService(baseURL, userAgent string, client *http.Client) *GeocodeService {
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}
	return &GeocodeService{
		baseURL:   strings.TrimRight(baseURL, "/"),
		userAgent: userAgent,
		client:    client,
		minGap:    time.Second,
		cache:     make(map[string]cacheEntry),
		ttl:       24 * time.Hour,
		maxKeys:   1000,
	}
}

func (s *GeocodeService) Search(ctx context.Context, q string) ([]model.Location, error) {
	q = strings.TrimSpace(q)
	if q == "" {
		return []model.Location{}, nil
	}
	key := "s:" + strings.ToLower(q)
	if cached, ok := s.getCache(key); ok {
		return cached, nil
	}
	u := fmt.Sprintf("%s/search?format=jsonv2&limit=5&q=%s", s.baseURL, url.QueryEscape(q))
	results, err := s.fetchList(ctx, u)
	if err != nil {
		return nil, err
	}
	s.putCache(key, results)
	return results, nil
}

func (s *GeocodeService) Reverse(ctx context.Context, lat, lon float64) (*model.Location, error) {
	key := fmt.Sprintf("r:%.5f,%.5f", lat, lon)
	if cached, ok := s.getCache(key); ok {
		if len(cached) == 0 {
			return nil, nil
		}
		return &cached[0], nil
	}
	u := fmt.Sprintf("%s/reverse?format=jsonv2&lat=%s&lon=%s",
		s.baseURL, strconv.FormatFloat(lat, 'f', -1, 64), strconv.FormatFloat(lon, 'f', -1, 64))
	loc, err := s.fetchOne(ctx, u)
	if err != nil {
		return nil, err
	}
	if loc == nil {
		s.putCache(key, []model.Location{})
		return nil, nil
	}
	s.putCache(key, []model.Location{*loc})
	return loc, nil
}

// nominatimItem is the subset of Nominatim's JSON we consume.
type nominatimItem struct {
	DisplayName string `json:"display_name"`
	Name        string `json:"name"`
	Lat         string `json:"lat"`
	Lon         string `json:"lon"`
}

func (n nominatimItem) toLocation() (model.Location, bool) {
	lat, err1 := strconv.ParseFloat(n.Lat, 64)
	lon, err2 := strconv.ParseFloat(n.Lon, 64)
	if err1 != nil || err2 != nil {
		return model.Location{}, false
	}
	label := n.DisplayName
	if label == "" {
		label = n.Name
	}
	return model.Location{Name: label, Lat: lat, Lon: lon}, true
}

func (s *GeocodeService) fetchList(ctx context.Context, u string) ([]model.Location, error) {
	body, err := s.do(ctx, u)
	if err != nil {
		return nil, err
	}
	var items []nominatimItem
	if err := json.Unmarshal(body, &items); err != nil {
		return nil, fmt.Errorf("decoding nominatim: %w", err)
	}
	out := make([]model.Location, 0, len(items))
	for _, it := range items {
		if loc, ok := it.toLocation(); ok {
			out = append(out, loc)
		}
	}
	return out, nil
}

func (s *GeocodeService) fetchOne(ctx context.Context, u string) (*model.Location, error) {
	body, err := s.do(ctx, u)
	if err != nil {
		return nil, err
	}
	var it nominatimItem
	if err := json.Unmarshal(body, &it); err != nil {
		return nil, fmt.Errorf("decoding nominatim: %w", err)
	}
	loc, ok := it.toLocation()
	if !ok {
		return nil, nil
	}
	return &loc, nil
}

func (s *GeocodeService) do(ctx context.Context, u string) ([]byte, error) {
	s.throttle()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", s.userAgent)
	req.Header.Set("Accept", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("nominatim status %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

func (s *GeocodeService) throttle() {
	s.throttleMu.Lock()
	defer s.throttleMu.Unlock()
	if wait := s.minGap - time.Since(s.lastCall); wait > 0 {
		time.Sleep(wait)
	}
	s.lastCall = time.Now()
}

func (s *GeocodeService) getCache(key string) ([]model.Location, bool) {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	e, ok := s.cache[key]
	if !ok || time.Now().After(e.expires) {
		return nil, false
	}
	return e.results, true
}

func (s *GeocodeService) putCache(key string, results []model.Location) {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	if len(s.cache) >= s.maxKeys {
		s.cache = make(map[string]cacheEntry) // simple bounded reset
	}
	s.cache[key] = cacheEntry{results: results, expires: time.Now().Add(s.ttl)}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend ; go test ./internal/service/ -run TestGeocode -v`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```
git add backend/internal/service/geocode.go backend/internal/service/geocode_test.go
git commit -m "feat(location): geocode service wrapping Nominatim (throttle + cache)"
```

---

## Task 7: Geocode handler + routes + wiring

**Files:**
- Create: `backend/internal/handler/geocode.go`
- Modify: `backend/cmd/server/main.go`

- [ ] **Step 1: Write the handler**

`backend/internal/handler/geocode.go`:

```go
package handler

import (
	"log/slog"
	"net/http"
	"strconv"

	"urban-tasks/internal/service"
)

type GeocodeHandler struct {
	svc *service.GeocodeService
}

func NewGeocodeHandler(svc *service.GeocodeService) *GeocodeHandler {
	return &GeocodeHandler{svc: svc}
}

func (h *GeocodeHandler) Search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	results, err := h.svc.Search(r.Context(), q)
	if err != nil {
		slog.Error("geocode search", "error", err)
		// Degrade gracefully: never block the user — return an empty list.
		respondJSON(w, http.StatusOK, []any{})
		return
	}
	respondJSON(w, http.StatusOK, results)
}

func (h *GeocodeHandler) Reverse(w http.ResponseWriter, r *http.Request) {
	lat, err1 := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lon, err2 := strconv.ParseFloat(r.URL.Query().Get("lon"), 64)
	if err1 != nil || err2 != nil || lat < -90 || lat > 90 || lon < -180 || lon > 180 {
		respondError(w, http.StatusBadRequest, "valid lat and lon are required")
		return
	}
	loc, err := h.svc.Reverse(r.Context(), lat, lon)
	if err != nil {
		slog.Error("geocode reverse", "error", err)
		respondJSON(w, http.StatusOK, nil)
		return
	}
	respondJSON(w, http.StatusOK, loc)
}
```

- [ ] **Step 2: Wire the service + handler in main.go**

In `backend/cmd/server/main.go`, in the Services block (after `searchSvc := ...`):

```go
	geocodeSvc := service.NewGeocodeService(cfg.NominatimURL, "urban-tasks/1.0 (https://github.com/fezcode/urban-tasks)", nil)
```

In the Handlers block (after `searchH := ...`):

```go
	geocodeH := handler.NewGeocodeHandler(geocodeSvc)
```

- [ ] **Step 3: Register the routes**

In the protected group (after the `// Global search` route), add:

```go
				// Geocoding (OpenStreetMap / Nominatim proxy)
				protected.Get("/geocode/search", geocodeH.Search)
				protected.Get("/geocode/reverse", geocodeH.Reverse)
```

- [ ] **Step 4: Build + verify routes manually**

Run: `cd backend ; go build ./...`
Then start the stack and, with a valid access token, run:
`curl -H "Authorization: Bearer <token>" "http://localhost:8080/api/v1/geocode/search?q=eiffel+tower"`
Expected: `{"data":[{"name":"Eiffel Tower, ...","lat":48.85...,"lon":2.29...}, ...]}` (port per `docker-compose.yml`/config).

- [ ] **Step 5: Commit**

```
git add backend/internal/handler/geocode.go backend/cmd/server/main.go
git commit -m "feat(location): geocode HTTP endpoints + wiring"
```

---

## Task 8: Backend manual round-trip verification

**Files:** none (verification only)

- [ ] **Step 1: Create a task with a location**

With a valid token + project id:

```
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"projectId":"<pid>","title":"Pick up order","location":{"name":"Blue Bottle Coffee","lat":37.8,"lon":-122.2}}' \
  http://localhost:8080/api/v1/tasks
```

Expected: 201 with `"location":{"name":"Blue Bottle Coffee","lat":37.8,"lon":-122.2}` in the response.

- [ ] **Step 2: Clear it via PATCH null**

```
curl -X PATCH -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"location":null}' http://localhost:8080/api/v1/tasks/<task-id>
```

Expected: 200, response has no `location` field (omitted because nil).

- [ ] **Step 3: Verify search finds it by place name**

Recreate the task with the location, then:
`curl -H "Authorization: Bearer <token>" "http://localhost:8080/api/v1/search?q=blue+bottle"`
Expected: the task appears in `data.tasks`.

- [ ] **Step 4: No commit** (verification only). If any step fails, fix the relevant earlier task before continuing.

---

## Task 9: Web — types + API client

**Files:**
- Modify: `frontend/src/context/types.ts`
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Add the `Location` type + task field**

In `frontend/src/context/types.ts`, add above `interface Task`:

```ts
export interface Location {
  name: string;
  lat: number;
  lon: number;
}
```

Add to `interface Task` (after `assigneeId`):

```ts
  location?: Location | null;
```

- [ ] **Step 2: Add the geocode client + create payload field**

In `frontend/src/api/client.ts`, import the type (extend the existing `import type { Project, Task } ...` line):

```ts
import type { Project, Task, Location } from '../context/types';
```

Add a `geocode` export (near the `search` export):

```ts
export const geocode = {
  search: (q: string) =>
    request<Location[]>(`/geocode/search?q=${encodeURIComponent(q)}`),
  reverse: (lat: number, lon: number) =>
    request<Location | null>(`/geocode/reverse?lat=${lat}&lon=${lon}`),
};
```

Add `location` to the `tasks.create` payload type (after `assigneeId?: string | null;`):

```ts
    location?: Location | null;
```

(`tasks.update` already accepts `Partial<Task>`, which now includes `location`.)

- [ ] **Step 3: Typecheck**

Run: `cd frontend ; npm run build` (or the project's typecheck script).
Expected: no type errors.

- [ ] **Step 4: Commit**

```
git add frontend/src/context/types.ts frontend/src/api/client.ts
git commit -m "feat(location): web Location type + geocode client"
```

---

## Task 10: Web — install Leaflet + `LocationField` component

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/components/LocationField.tsx`

- [ ] **Step 1: Install dependencies**

Run: `cd frontend ; npm install leaflet react-leaflet ; npm install -D @types/leaflet`
Expected: packages added to `package.json`.

- [ ] **Step 2: Create the component**

`frontend/src/components/LocationField.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, X, Search } from 'lucide-react';
import { geocode } from '../api/client';
import type { Location } from '../context/types';

// Fix Leaflet's default marker icon paths under Vite bundling.
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], map.getZoom());
  }, [lat, lon, map]);
  return null;
}

interface Props {
  value?: Location | null;
  onChange: (loc: Location | null) => void;
}

export default function LocationField({ value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Location[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      try {
        setResults(await geocode.search(query));
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 400);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  const pick = (loc: Location) => {
    onChange(loc);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const onMarkerDragEnd = async (e: L.DragEndEvent) => {
    const { lat, lng } = e.target.getLatLng();
    try {
      const loc = await geocode.reverse(lat, lng);
      onChange(loc ?? { name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lon: lng });
    } catch {
      onChange({ name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lon: lng });
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <MapPin size={14} className="text-text-tertiary" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
          Location
        </span>
      </div>

      <div className="relative">
        <div className="flex items-center gap-2 rounded-lg bg-surface-hover px-2.5 py-1.5">
          <Search size={13} className="text-text-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            placeholder="Search an address or place…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-text-tertiary"
          />
        </div>
        {open && results.length > 0 && (
          <ul className="absolute z-[1000] mt-1 w-full max-h-52 overflow-auto rounded-lg border border-border bg-surface shadow-lg">
            {results.map((r, i) => (
              <li key={`${r.lat},${r.lon},${i}`}>
                <button
                  onClick={() => pick(r)}
                  className="block w-full px-3 py-2 text-left text-[12px] text-text-secondary hover:bg-surface-hover"
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {value && (
        <div className="mt-2">
          <div className="h-40 w-full overflow-hidden rounded-lg border border-border">
            <MapContainer
              center={[value.lat, value.lon]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Recenter lat={value.lat} lon={value.lon} />
              <Marker
                position={[value.lat, value.lon]}
                icon={markerIcon}
                draggable
                eventHandlers={{ dragend: onMarkerDragEnd }}
              />
            </MapContainer>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <a
              href={`https://www.openstreetmap.org/?mlat=${value.lat}&mlon=${value.lon}#map=16/${value.lat}/${value.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-[12px] text-accent hover:underline"
              title={value.name}
            >
              ↗ {value.name}
            </a>
            <button
              onClick={() => onChange(null)}
              className="flex shrink-0 items-center gap-1 text-[11px] text-text-tertiary hover:text-danger"
            >
              <X size={12} /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

(Note: `lucide-react` icons and `text-*`/`bg-*`/`border-border` tokens already exist in this project — `TaskDetail.tsx` imports from `lucide-react` and uses these classes.)

- [ ] **Step 3: Typecheck/build**

Run: `cd frontend ; npm run build`
Expected: compiles (Leaflet types resolve).

- [ ] **Step 4: Commit**

```
git add frontend/package.json frontend/package-lock.json frontend/src/components/LocationField.tsx
git commit -m "feat(location): web LocationField (Leaflet search + drag-pin)"
```

---

## Task 11: Web — wire `LocationField` into `TaskDetail` + chip in `TaskItem`

**Files:**
- Modify: `frontend/src/components/TaskDetail.tsx`
- Modify: `frontend/src/components/TaskItem.tsx`

- [ ] **Step 1: Import the component + Location type in TaskDetail**

At the top of `frontend/src/components/TaskDetail.tsx`, after the `import DatePicker from './DatePicker';` line:

```tsx
import LocationField from './LocationField';
import type { Location } from '../context/types';
```

(If `TaskDetail.tsx` already imports from `../context/types`, add `Location` to that existing import instead of adding a new line.)

- [ ] **Step 2: Add the `setLocation` dispatcher**

Next to `setAssignee` (around the other `set*` helpers), add:

```tsx
  const setLocation = (location: Location | null) => {
    syncDispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      updates: { location },
    });
  };
```

- [ ] **Step 3: Render the field**

Immediately after the closing `</div>` of the `{/* Due date */}` block (before `{/* Priority */}`), insert:

```tsx
        {/* Location */}
        <LocationField value={task.location} onChange={setLocation} />
```

- [ ] **Step 4: Add the chip to TaskItem**

Open `frontend/src/components/TaskItem.tsx`. Find where due-date / tag metadata chips are rendered on the row (search for `dueDate` or `tags`). Add, alongside those chips, conditional on a location:

```tsx
{task.location && (
  <span
    className="inline-flex items-center gap-1 max-w-[140px] truncate text-[11px] text-text-tertiary"
    title={task.location.name}
  >
    <MapPin size={11} className="shrink-0" />
    <span className="truncate">{task.location.name}</span>
  </span>
)}
```

Ensure `MapPin` is imported from `lucide-react` at the top of `TaskItem.tsx` (add it to the existing `lucide-react` import; if there is none, add `import { MapPin } from 'lucide-react';`).

- [ ] **Step 5: Build + manual check**

Run: `cd frontend ; npm run build`
Then `npm run dev`, open a task: search an address → pick it → map + pin appear; drag the pin → label updates; the row shows a 📍 chip; "Remove" clears it; reload persists.

- [ ] **Step 6: Commit**

```
git add frontend/src/components/TaskDetail.tsx frontend/src/components/TaskItem.tsx
git commit -m "feat(location): web — LocationField in detail + chip on task rows"
```

---

## Task 12: Mobile — types + API client + WebView dep

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/src/api/client.ts`

- [ ] **Step 1: Install react-native-webview**

Run: `cd mobile ; npx expo install react-native-webview`
Expected: dependency added (Expo picks the SDK-compatible version).

- [ ] **Step 2: Add types + geocode client + payload field**

In `mobile/src/api/client.ts`, add the type near the `Task` interface:

```ts
export interface Location {
  name: string;
  lat: number;
  lon: number;
}
```

Add to `interface Task` (after `assigneeId`):

```ts
  location?: Location | null;
```

Add `location?: Location | null;` to the task create payload type (after its `assigneeId?: string | null;` field — around line 315 in the create function's argument type).

Add a `geocode` client mirroring the existing `request`-based exports in this file (use the same `request`/`API_BASE` helper the file already defines for authed calls):

```ts
export const geocode = {
  search: (q: string) =>
    request<Location[]>(`/geocode/search?q=${encodeURIComponent(q)}`),
  reverse: (lat: number, lon: number) =>
    request<Location | null>(`/geocode/reverse?lat=${lat}&lon=${lon}`),
};
```

(If this file groups endpoints under a single object instead of individual exports, follow that local pattern instead — match the surrounding code.)

- [ ] **Step 3: Typecheck (local binary)**

Run the mobile typecheck via the project's local TypeScript binary (per project convention), e.g. `cd mobile ; .\node_modules\.bin\tsc --noEmit`.
Expected: no errors.

- [ ] **Step 4: Commit**

```
git add mobile/package.json mobile/package-lock.json mobile/src/api/client.ts
git commit -m "feat(location): mobile Location type + geocode client + webview dep"
```

---

## Task 13: Mobile — `LocationField` (Leaflet in WebView)

**Files:**
- Create: `mobile/src/components/LocationField.tsx`

- [ ] **Step 1: Create the component**

`mobile/src/components/LocationField.tsx`. It renders a Leaflet map inside a WebView (pure OSM tiles, no native map SDK). Tapping/dragging the map posts coordinates back to RN; the search box hits the backend geocode proxy.

```tsx
import { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import { WebView } from 'react-native-webview';
import { geocode, type Location } from '../api/client';
import { colors } from '../theme';

interface Props {
  value?: Location | null;
  onChange: (loc: Location | null) => void;
}

// Self-contained Leaflet page. We pass the initial center in; taps post {lat,lon} back.
function mapHtml(lat: number, lon: number): string {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;margin:0}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map').setView([${lat}, ${lon}], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: '&copy; OpenStreetMap' }).addTo(map);
  var marker = L.marker([${lat}, ${lon}], { draggable: true }).addTo(map);
  function post(ll){ window.ReactNativeWebView.postMessage(JSON.stringify({lat: ll.lat, lon: ll.lng})); }
  marker.on('dragend', function(){ post(marker.getLatLng()); });
  map.on('click', function(e){ marker.setLatLng(e.latlng); post(e.latlng); });
</script></body></html>`;
}

export default function LocationField({ value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Location[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onQuery = (q: string) => {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        setResults(await geocode.search(q));
      } catch {
        setResults([]);
      }
    }, 400);
  };

  const pick = (loc: Location) => {
    onChange(loc);
    setQuery('');
    setResults([]);
  };

  const onMapMessage = async (raw: string) => {
    try {
      const { lat, lon } = JSON.parse(raw) as { lat: number; lon: number };
      const loc = await geocode.reverse(lat, lon);
      onChange(loc ?? { name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon });
    } catch {
      /* ignore malformed messages */
    }
  };

  const html = useMemo(
    () => (value ? mapHtml(value.lat, value.lon) : ''),
    [value?.lat, value?.lon],
  );

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase' }}>
        Location
      </Text>
      <TextInput
        value={query}
        onChangeText={onQuery}
        placeholder="Search an address or place…"
        placeholderTextColor={colors.textTertiary}
        style={{ backgroundColor: colors.surfaceHover, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.textPrimary }}
      />
      {results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(r, i) => `${r.lat},${r.lon},${i}`}
          style={{ maxHeight: 160, backgroundColor: colors.surface, borderRadius: 8 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => pick(item)} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 13 }}>{item.name}</Text>
            </Pressable>
          )}
        />
      )}
      {value && (
        <View style={{ gap: 6 }}>
          <View style={{ height: 180, borderRadius: 8, overflow: 'hidden' }}>
            <WebView
              originWhitelist={['*']}
              source={{ html }}
              onMessage={(e) => onMapMessage(e.nativeEvent.data)}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text numberOfLines={1} style={{ flex: 1, color: colors.textSecondary, fontSize: 12 }}>
              📍 {value.name}
            </Text>
            <Pressable onPress={() => onChange(null)}>
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Remove</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Reconcile theme token names**

Open `mobile/src/theme` (its `index.ts`/palette). Confirm the token names used above (`colors.textTertiary`, `surfaceHover`, `surface`, `textPrimary`, `textSecondary`). If the palette uses different names, update the component to match the real tokens.

- [ ] **Step 3: Typecheck**

Run: `cd mobile ; .\node_modules\.bin\tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```
git add mobile/src/components/LocationField.tsx
git commit -m "feat(location): mobile LocationField (Leaflet-in-WebView)"
```

---

## Task 14: Mobile — wire into task edit + 📍 chip

**Files:**
- Modify: `mobile/app/(app)/tasks.tsx`

- [ ] **Step 1: Locate the edit form and row/modal**

Open `mobile/app/(app)/tasks.tsx`. Find: (a) the task create/edit form where fields like due date / assignee are edited, (b) the `TaskRow` rendering, and (c) the task view modal. Search for `dueDate` and `assigneeId` to anchor.

- [ ] **Step 2: Render `LocationField` in the edit form**

Import at the top:

```tsx
import LocationField from '../../src/components/LocationField';
```

In the edit form, where the editable task state is held, render the field bound to the task's location and dispatch an update on change. Use the same update path the form already uses for other fields (e.g. the existing `updateTask`/`api.tasks.update` call). Concretely, alongside the other fields:

```tsx
<LocationField
  value={editing.location}
  onChange={(location) => updateTaskField({ location })}
/>
```

(Replace `editing` and `updateTaskField` with the form's actual state variable and its field-update helper — match how due date is wired in this same form.)

- [ ] **Step 3: Add the 📍 chip to the row + view modal**

In `TaskRow` (and the view modal's metadata area), where other chips (due date / assignee) render, add:

```tsx
{task.location ? (
  <Text numberOfLines={1} style={{ fontSize: 11, color: colors.textTertiary, maxWidth: 140 }}>
    📍 {task.location.name}
  </Text>
) : null}
```

- [ ] **Step 4: Typecheck**

Run: `cd mobile ; .\node_modules\.bin\tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual check (if a device/emulator is available)**

Run: `cd mobile ; npx expo start`. Open a task → search/select a place → map renders in WebView → tap to move pin → label updates → row shows 📍 chip → Remove clears.

- [ ] **Step 6: Commit**

```
git add mobile/app/(app)/tasks.tsx
git commit -m "feat(location): mobile — LocationField in edit + chip on rows"
```

---

## Task 15: TUI — types + geocode client

**Files:**
- Modify: `tui/src/api.ts`

- [ ] **Step 1: Add the `Location` type + task field**

In `tui/src/api.ts`, add near `TaskLink`:

```ts
export interface Location {
  name: string;
  lat: number;
  lon: number;
}
```

Add to `interface Task` (after `assigneeId`):

```ts
  location?: Location | null;
```

- [ ] **Step 2: Add geocode calls + payload fields**

Add `location` to the create and update payload field lists in this file (mirror where `dueDate`/`assigneeId` appear in those payload type literals — around lines 178–200):

```ts
        location?: Location | null;
```

Add geocode calls following the file's existing request helper (match how `tasks`/`search` calls are written in this file):

```ts
export const geocode = {
  search: (q: string) =>
    request<Location[]>(`/geocode/search?q=${encodeURIComponent(q)}`),
  reverse: (lat: number, lon: number) =>
    request<Location | null>(`/geocode/reverse?lat=${lat}&lon=${lon}`),
};
```

(If this file exposes one API object rather than named exports, add `geocode` to that object instead — match the local style.)

- [ ] **Step 3: Typecheck**

Run: `cd tui ; npm run build` (or the TUI's typecheck/build script).
Expected: no errors.

- [ ] **Step 4: Commit**

```
git add tui/src/api.ts
git commit -m "feat(location): TUI Location type + geocode client"
```

---

## Task 16: TUI — search row in form + display in detail + list chip

**Files:**
- Modify: `tui/src/screens/task-form.tsx`
- Modify: `tui/src/screens/task-detail.tsx`
- Modify: `tui/src/screens/tasks.tsx`

- [ ] **Step 1: Add a location field to the form**

Open `tui/src/screens/task-form.tsx`. Add a "Location" row to the form's field list. Behavior:
- Display the current `location?.name` (or "—" when unset).
- When the row is focused, typing opens a query; on submit, call `geocode.search(query)` and show the returned names as a selectable list (reuse the form's existing list/selection primitive — e.g. how tags or assignee picking works in this file).
- Selecting an item sets the form's `location` to that `Location`.
- A clear key (e.g. `x` or backspace on the row, consistent with how the form clears other optional fields) sets `location` to `null`.

Wire `location` into the object the form submits (it already builds a create/update payload — add `location` to it, mirroring `dueDate`).

Use `import { geocode, type Location } from '../api';` (match the file's existing import path/style).

- [ ] **Step 2: Show location in the detail screen**

Open `tui/src/screens/task-detail.tsx`. Where other metadata (due date, assignee, tags) renders, add, when `task.location` is set:

```tsx
<Text>📍 {task.location.name}</Text>
<Text dimColor>https://www.openstreetmap.org/?mlat={task.location.lat}&mlon={task.location.lon}#map=16/{task.location.lat}/{task.location.lon}</Text>
```

(Use the screen's existing `Text` import from `ink` and match its layout/`Box` structure.)

- [ ] **Step 3: Inline chip on the task list row**

Open `tui/src/screens/tasks.tsx`. Where the row renders metadata (priority/due chips), append, when present:

```tsx
{task.location ? <Text dimColor> 📍 {task.location.name}</Text> : null}
```

- [ ] **Step 4: Typecheck/build**

Run: `cd tui ; npm run build`
Expected: no errors.

- [ ] **Step 5: Manual check**

Run the TUI against the backend; open a task → set a location via search → it shows in detail + list; clear works.

- [ ] **Step 6: Commit**

```
git add tui/src/screens/task-form.tsx tui/src/screens/task-detail.tsx tui/src/screens/tasks.tsx
git commit -m "feat(location): TUI — search row, detail display, list chip"
```

---

## Task 17: Final verification + roadmap note

**Files:**
- Modify: `PLANS.md`

- [ ] **Step 1: Full backend test + vet**

Run: `cd backend ; go build ./... ; go vet ./... ; go test ./...`
Expected: all green.

- [ ] **Step 2: Typecheck all clients**

Run: `cd frontend ; npm run build` — then — `cd mobile ; .\node_modules\.bin\tsc --noEmit` — then — `cd tui ; npm run build`
Expected: all pass.

- [ ] **Step 3: Cross-surface smoke**

With the stack running: set a location on web, confirm it appears on the TUI list and (if available) mobile for the same task; confirm global search by place name; confirm clear works on each surface.

- [ ] **Step 4: Add a roadmap line**

In `PLANS.md`, under an appropriate section (e.g. a new `## Location` heading near Integrations), add:

```md
## Location
- [x] **Task locations + OpenStreetMap** — optional place per task ({name, lat, lon}); address search + drag-pin via backend Nominatim proxy (throttle + cache); Leaflet on web, Leaflet-in-WebView on mobile, text on TUI; 📍 chip on rows; location name folded into global search; clearable.
```

- [ ] **Step 5: Commit**

```
git add PLANS.md
git commit -m "docs(location): mark task locations + OpenStreetMap shipped"
```

---

## Notes & risks

- **pgx JSONB + nil pointer:** `Location` is stored exactly like `Links`/`Subtasks` (Go value → JSONB). A nil `*Location` must persist as SQL `NULL`. If the round-trip in Task 8 shows a literal JSON `null` stored instead of SQL NULL (or a scan error), wrap the column with an explicit codec: pass `t.Location` through `json.Marshal` into a `[]byte` (nil → nil) on write, and scan into `[]byte` then `json.Unmarshal` on read. Verify in Task 8 before moving on.
- **OSM tile/Nominatim usage:** fine for low volume with the set User-Agent + attribution. For production scale, swap `NOMINATIM_URL` to a self-hosted/commercial endpoint and a paid tile provider; no code change needed beyond config + the web/mobile tile URL.
- **Leaflet marker assets** are loaded from unpkg to avoid Vite asset-path issues; if offline/CSP-restricted, vendor them into `public/` and point the icon URLs there.
- **Mobile/TUI anchors:** Tasks 14 and 16 modify existing screens whose exact internals should be read at execution time; the steps name the real files and the fields to mirror (`dueDate`, `assigneeId`) so the insertion points are unambiguous.
```
