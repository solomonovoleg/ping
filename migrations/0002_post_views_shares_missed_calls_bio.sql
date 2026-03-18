-- Просмотры постов (уникальный пользователь = один просмотр)
CREATE TABLE IF NOT EXISTS post_views (
  post_id VARCHAR NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- Пересылка поста другому пользователю (для истории)
CREATE TABLE IF NOT EXISTS post_shares (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  post_id VARCHAR NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  from_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Пропущенные звонки (для отображения в чате и списке)
CREATE TABLE IF NOT EXISTS missed_calls (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id VARCHAR NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  caller_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  callee_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Описание профиля (как в ВК/Instagram)
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- Типы сообщений: добавляем missed_call и post_share (если enum не используется, можно хранить в type text)
-- В текущей схеме messages.type уже text с enum в приложении; добавляем поддержку новых типов в коде
COMMENT ON TABLE post_views IS 'Уникальные просмотры постов';
COMMENT ON TABLE post_shares IS 'Пересылки постов пользователям';
COMMENT ON TABLE missed_calls IS 'Пропущенные звонки';
