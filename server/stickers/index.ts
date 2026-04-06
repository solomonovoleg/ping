/**
 * Домен «пользовательские стикер-паки»: HTTP, БД, сжатие, валидация исходящего сообщения.
 * Точка входа для приложения — `registerStickerPackRoutes`.
 */
export { registerStickerPackRoutes } from "./register-sticker-routes";
export { resolveStickerMessageContent } from "./resolve-outgoing-sticker-content";
export { STICKER_UPLOAD_SUBDIR } from "./sticker-constants";
