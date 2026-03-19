-- Флаг отображения обложки профиля (можно хранить обложку, но скрывать её)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS show_cover BOOLEAN NOT NULL DEFAULT true;

