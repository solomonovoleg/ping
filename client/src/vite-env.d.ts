/// <reference types="vite/client" />

declare const __BUILD_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  /** URL страницы политики конфиденциальности (для App Store и ссылок в приложении). */
  readonly VITE_PRIVACY_POLICY_URL?: string;
  /** Email поддержки (для App Store Review и раздела «Поддержка»). */
  readonly VITE_SUPPORT_EMAIL?: string;
  /** Базовый URL микросервиса ПИНГОК МИКРО (NLU), без завершающего слэша. */
  readonly VITE_PINGOK_MICRO_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
