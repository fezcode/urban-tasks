ALTER TABLE tasks
  ADD COLUMN priority TEXT NOT NULL DEFAULT 'none'
  CHECK (priority IN ('none', 'low', 'medium', 'high'));

CREATE INDEX idx_tasks_priority ON tasks(user_id, priority) WHERE priority != 'none';
