-- Full-text search across tasks (title + body) and comments.
-- Generated tsvector columns keep the index in sync without triggers.

ALTER TABLE tasks ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(body,  '')), 'B')
    ) STORED;

CREATE INDEX idx_tasks_search ON tasks USING GIN (search_vector);

ALTER TABLE task_comments ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', coalesce(body, ''))) STORED;

CREATE INDEX idx_task_comments_search ON task_comments USING GIN (search_vector);
