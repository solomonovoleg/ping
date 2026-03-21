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

/**
 * Поток PCM → `group.asr-pcm` (нужен CALL_TRANSCRIPTS_ASR_WS_URL на сервере).
 * По умолчанию выкл.: иначе при живом PCM клиент не шлёт webm-чанки, а сервер без WS молча игнорирует PCM — титров нет.
 * Включай =1, когда Vosk stream (WS) точно поднят и прописан в .env на VPS.
 */
export function isGroupCallAsrPcmStreamPreferred(): boolean {
  return truthyEnv(env?.VITE_GROUP_CALLS_ASR_PCM_STREAM);
}
