-- Кто может писать вам в личку / создавать с вами чат: all | followers | mutual
ALTER TABLE users ADD COLUMN IF NOT EXISTS dm_policy varchar(20) NOT NULL DEFAULT 'all';
-- Кто может добавлять вас в групповые чаты: all | followers | mutual (followers = вы подписаны на того, кто добавляет)
ALTER TABLE users ADD COLUMN IF NOT EXISTS group_add_me_policy varchar(20) NOT NULL DEFAULT 'all';
