-- Saved filters / smart lists: per-user named views serialized to JSON.

CREATE TABLE saved_filters (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    icon        TEXT,
    filter      JSONB NOT NULL DEFAULT '{}'::jsonb,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_filters_user ON saved_filters(user_id, position);
