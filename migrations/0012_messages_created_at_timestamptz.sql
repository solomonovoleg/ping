-- Сообщения: created_at в UTC (timestamptz).
-- Если сервер хранил naive timestamp в локальной зоне (Europe/Moscow), конвертируем в UTC.
-- Для сервера в UTC замените 'Europe/Moscow' на 'UTC' перед запуском миграции.
ALTER TABLE messages
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'Europe/Moscow';
