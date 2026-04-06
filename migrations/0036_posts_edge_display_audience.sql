-- Кто видит пост с EDGE: self | followers | public (синхрон с config_json.displayAudience в EDGE).
ALTER TABLE posts ADD COLUMN IF NOT EXISTS edge_display_audience varchar(20);
