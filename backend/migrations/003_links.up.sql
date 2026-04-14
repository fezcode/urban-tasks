-- Add links to tasks
ALTER TABLE tasks ADD COLUMN links JSONB NOT NULL DEFAULT '[]';
