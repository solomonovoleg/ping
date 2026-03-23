-- Текст для заблокированного (необязательно): показываем при ограничении чата/профиля
ALTER TABLE user_blocks
  ADD COLUMN IF NOT EXISTS block_note varchar(500);
