-- Pinboard: a per-project corkboard of pinned task cards connected by labeled string.

CREATE TABLE pinboard_cards (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    x           DOUBLE PRECISION NOT NULL DEFAULT 0,
    y           DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, task_id)
);

CREATE INDEX idx_pinboard_cards_project ON pinboard_cards(project_id);

-- Undirected string between two pinned tasks. The pair is stored smaller-id-first
-- (a_task_id < b_task_id) so A-B and B-A collapse to a single row.
CREATE TABLE pinboard_connections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    a_task_id   UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    b_task_id   UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    label       TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, a_task_id, b_task_id),
    CHECK (a_task_id <> b_task_id)
);

CREATE INDEX idx_pinboard_connections_project ON pinboard_connections(project_id);
