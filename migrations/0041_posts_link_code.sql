-- Короткий публичный код ссылки на пост (URL /u/…/p/{link_code} вместо UUID).
ALTER TABLE posts ADD COLUMN IF NOT EXISTS link_code varchar(12);

CREATE UNIQUE INDEX IF NOT EXISTS posts_link_code_key ON posts (link_code);

DO $$
DECLARE
  r RECORD;
  new_code text;
BEGIN
  FOR r IN SELECT id FROM posts WHERE link_code IS NULL LOOP
    LOOP
      new_code := lower(substr(md5(random()::text || clock_timestamp()::text || r.id::text), 1, 10));
      BEGIN
        UPDATE posts SET link_code = new_code WHERE id = r.id;
        EXIT;
      EXCEPTION
        WHEN unique_violation THEN
          NULL;
      END;
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE posts ALTER COLUMN link_code SET NOT NULL;
