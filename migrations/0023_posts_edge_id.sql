-- Привязка поста ленты к кампании EDGE (интерактив). Без FK — таблица кампаний может жить в отдельном сервисе/БД.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS edge_id VARCHAR(128);
CREATE INDEX IF NOT EXISTS idx_posts_edge_id ON posts(edge_id) WHERE edge_id IS NOT NULL;
