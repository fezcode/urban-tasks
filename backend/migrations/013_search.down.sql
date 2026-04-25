DROP INDEX IF EXISTS idx_task_comments_search;
ALTER TABLE task_comments DROP COLUMN IF EXISTS search_vector;
DROP INDEX IF EXISTS idx_tasks_search;
ALTER TABLE tasks DROP COLUMN IF EXISTS search_vector;
