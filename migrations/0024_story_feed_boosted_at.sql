-- Время последнего «пинга» ленты: лайк или ответ на сториз поднимают автора в полоске на ~10 мин.
ALTER TABLE stories ADD COLUMN IF NOT EXISTS feed_boosted_at TIMESTAMPTZ;
