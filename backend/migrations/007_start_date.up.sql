-- Add optional start_date to tasks. May predate created_at when the user
-- is logging work that began before the task was entered.
ALTER TABLE tasks ADD COLUMN start_date DATE;
