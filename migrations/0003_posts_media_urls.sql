-- Несколько фото/видео в посте (как во ВКонтакте)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_urls JSONB;

-- Переносим старые одиночные картинки в массив
UPDATE posts
SET media_urls = jsonb_build_array(image_url)
WHERE image_url IS NOT NULL AND image_url != ''
  AND (media_urls IS NULL OR media_urls = '[]'::jsonb);
