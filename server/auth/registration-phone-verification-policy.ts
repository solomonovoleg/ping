import { platformGetPublic, type PlatformPublicDto } from "../admin/ops/platform.repo";
import { isNewTelCallPasswordEnabled } from "./new-tel/call-password-core";

/**
 * Нужен ли клиенту и API шаг «звонок + тикет» при регистрации.
 * Решает только админка (platform_settings) + доступность New-Tel на сервере.
 * Переменная REGISTER_REQUIRE_PHONE_CALL_VERIFICATION больше не используется — включение/выключение только из админки.
 *
 * @param platform — опционально уже загруженные настройки (один SELECT на запрос).
 */
export async function isRegistrationPhoneCallVerificationRequiredResolved(
  platform?: PlatformPublicDto,
): Promise<boolean> {
  const p = platform ?? (await platformGetPublic());
  if (!p.registrationPhoneCallVerificationEnabled) return false;
  return isNewTelCallPasswordEnabled();
}
