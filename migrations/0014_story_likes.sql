CREATE TABLE IF NOT EXISTS story_likes (
  story_id varchar NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);
