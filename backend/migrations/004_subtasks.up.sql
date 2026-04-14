-- Add subtasks to tasks
ALTER TABLE tasks ADD COLUMN subtasks JSONB NOT NULL DEFAULT '[]';
