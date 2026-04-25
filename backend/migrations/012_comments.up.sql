-- Task comments + @mentions.

CREATE TABLE task_comments (
    id          UUID PRIMARY KEY,
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    mentions    JSONB NOT NULL DEFAULT '[]'::jsonb,
    edited_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_comments_task ON task_comments(task_id, created_at);
CREATE INDEX idx_task_comments_user ON task_comments(user_id);
