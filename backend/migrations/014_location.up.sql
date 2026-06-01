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
