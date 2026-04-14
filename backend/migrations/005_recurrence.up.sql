-- Add recurrence to tasks
ALTER TABLE tasks ADD COLUMN recurrence TEXT;
ALTER TABLE tasks ADD CONSTRAINT tasks_recurrence_check
  CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekly', 'biweekly', 'monthly'));
