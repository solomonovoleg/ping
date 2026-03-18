-- Лимит имени и фамилии: не более 12 символов. Обрезаем существующие значения.
UPDATE users
SET
  display_name = LEFT(COALESCE(display_name, ''), 12),
  surname = LEFT(COALESCE(surname, ''), 12);
