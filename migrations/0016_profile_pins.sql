-- Папки и элементы «Закреплённое» в профиле (посты и сториз).
CREATE TABLE IF NOT EXISTS profile_pin_folders (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL,
  description text,
  cover_url text,
  cover_is_video boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_pin_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id varchar NOT NULL REFERENCES profile_pin_folders(id) ON DELETE CASCADE,
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind varchar(10) NOT NULL,
  post_id varchar REFERENCES posts(id) ON DELETE CASCADE,
  story_id varchar REFERENCES stories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_pin_folders_owner ON profile_pin_folders(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_pin_items_folder ON profile_pin_items(folder_id);
CREATE INDEX IF NOT EXISTS idx_profile_pin_items_owner ON profile_pin_items(owner_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS profile_pin_items_folder_post_uniq
  ON profile_pin_items (folder_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profile_pin_items_folder_story_uniq
  ON profile_pin_items (folder_id, story_id) WHERE story_id IS NOT NULL;
