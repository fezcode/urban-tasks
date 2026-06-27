DROP INDEX IF EXISTS idx_pinboard_connections_b;
DROP INDEX IF EXISTS idx_pinboard_connections_a;
DROP TABLE IF EXISTS pinboard_boards;
ALTER TABLE pinboard_cards DROP COLUMN IF EXISTS color;
