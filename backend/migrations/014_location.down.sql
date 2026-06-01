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
