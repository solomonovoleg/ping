/** https://developer.apple.com/support/offering-account-deletion-in-your-app/ */
export const APPLE_ACCOUNT_DELETION_SUPPORT_URL =
  "https://developer.apple.com/support/offering-account-deletion-in-your-app/";

/** Ключевые ожидания Apple (сжато по официальной справке). */
export const APPLE_ACCOUNT_DELETION_EXPECTATIONS = [
  "Приложения с регистрацией аккаунта должны позволять инициировать удаление аккаунта из приложения.",
  "Недостаточно только «деактивации»: нужно полноценное удаление аккаунта и связанных персональных данных согласно правилам.",
  "Пункт удаления должен быть легко найти (обычно в настройках).",
  "Допустимы подтверждение и повторная аутентификация; необоснованно усложнять удаление нельзя.",
] as const;
