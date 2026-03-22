-- Транскрипт голосовых и видеокружков (ASR + перевод чата).
ALTER TABLE messages ADD COLUMN IF NOT EXISTS transcript TEXT;
