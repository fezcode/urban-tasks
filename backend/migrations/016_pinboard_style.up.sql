-- Pinboard styling: per-card hand-picked color, per-project board color,
-- and indexes so a task's string connections can be fetched cheaply for the
-- task detail view.

ALTER TABLE pinboard_cards ADD COLUMN color TEXT;

CREATE TABLE pinboard_boards (
    project_id  UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    bg_color    TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lookups of "what is this task strung to" hit either endpoint column.
CREATE INDEX idx_pinboard_connections_a ON pinboard_connections(a_task_id);
CREATE INDEX idx_pinboard_connections_b ON pinboard_connections(b_task_id);
