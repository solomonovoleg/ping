-- Превью внешних видеоссылок (YouTube и др.) в карточке поста; можно отключить при публикации.
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS link_embed_enabled boolean NOT NULL DEFAULT true;
