-- Раздельный буст ленты: лайк (короче) и ответ в чате (дольше).
ALTER TABLE stories ADD COLUMN IF NOT EXISTS feed_boost_like_at TIMESTAMPTZ;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS feed_boost_reply_at TIMESTAMPTZ;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stories' AND column_name = 'feed_boosted_at'
  ) THEN
    UPDATE stories
    SET
      feed_boost_like_at = COALESCE(feed_boost_like_at, feed_boosted_at),
      feed_boost_reply_at = COALESCE(feed_boost_reply_at, feed_boosted_at)
    WHERE feed_boosted_at IS NOT NULL;
    ALTER TABLE stories DROP COLUMN feed_boosted_at;
  END IF;
END $$;
