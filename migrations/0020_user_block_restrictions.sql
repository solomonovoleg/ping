-- Гранулярные ограничения блокировки (по умолчанию true = поведение как до миграции)
ALTER TABLE user_blocks
  ADD COLUMN IF NOT EXISTS restrict_profile boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS restrict_chat boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS restrict_social boolean NOT NULL DEFAULT true;
