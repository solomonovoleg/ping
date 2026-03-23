-- Посещения профиля (каждый заход — отдельная строка; для уникальных зрителей — COUNT DISTINCT viewer_user_id)
CREATE TABLE IF NOT EXISTS profile_page_views (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_page_views_profile_time ON profile_page_views (profile_user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_page_views_profile_viewer ON profile_page_views (profile_user_id, viewer_user_id);
