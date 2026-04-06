-- PRIME CODE: непустое значение = доступ к разделу «API HUB» на Борде (назначает админ).
ALTER TABLE users ADD COLUMN IF NOT EXISTS board_api_hub_prime_code varchar(64);

COMMENT ON COLUMN users.board_api_hub_prime_code IS 'Не NULL и непустая строка: пользователь видит API HUB на Борде.';
