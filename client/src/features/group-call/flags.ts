/**
 * Групповые звонки — отдельный модуль. Без env-флага модуль считается выключенным.
 * Не влияет на тет-а-тет: импорты из call-controller / CallContext не требуются.
 */
function truthyEnv(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const n = value.trim().toLowerCase();
  return n === "1" || n === "true" || n === "yes" || n === "on";
}

const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;

export function isGroupCallModuleEnabled(): boolean {
  return truthyEnv(env?.VITE_GROUP_CALLS_ENABLED);
}

export function isGroupCallServerAsrEnabled(): boolean {
  return truthyEnv(env?.VITE_GROUP_CALLS_SERVER_ASR);
}
