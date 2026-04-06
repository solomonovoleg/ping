/**
 * Единое место для SEO: подстановка в index.html (Vite) и экран в админке.
 * При изменении текста — только здесь; пересобрать клиент.
 */
export const SITE_DOCUMENT_TITLE = "PING — Персональный мессенджер";

export const SITE_META_DESCRIPTION =
  "Персональные чаты, видеозвонки, без рекламы и спама";

export const SITE_OG_LOCALE = "ru_RU";

/** Короткое имя под иконку на экране «Домой» (iOS). */
export const SITE_APPLE_WEB_APP_TITLE = "PING";

/**
 * Относительный путь к картинке превью (og / twitter).
 * При `vite build` плагин подставляет абсолютный URL (Open Graph): см. {@link SITE_DEFAULT_ORIGIN} или `VITE_SITE_ORIGIN`.
 */
export const SITE_OG_IMAGE_PATH = "/F-PING.png?v=4";

/** Публичный origin прод-сайта (без слэша). Для своего домена: `VITE_SITE_ORIGIN` при сборке. */
export const SITE_DEFAULT_ORIGIN = "https://pingos.ru";
