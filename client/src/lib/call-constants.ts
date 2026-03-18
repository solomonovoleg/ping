/**
 * Таймауты звонков на клиенте. Должны совпадать с сервером (server/calls/ws.ts) или быть чуть больше.
 * Переменные VITE_CALLS_* позволяют переопределить в .env при необходимости.
 */

function numFromEnv(value: string | undefined, fallback: number): number {
  if (value == null || value === "") return fallback;
  const v = Number(value);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;

/** Таймаут ожидания ответа (звонящий), мс. На сервере — тот же интервал, после него «пропущенный звонок». */
export const RING_TIMEOUT_MS = numFromEnv(env?.VITE_CALLS_RING_TIMEOUT_MS as string | undefined, 30 * 1000);

/** Таймаут ожидания offer при принятии звонка (offer пришёл позже, чем accept). */
export const CONNECTING_OFFER_TIMEOUT_MS = numFromEnv(env?.VITE_CALLS_CONNECTING_OFFER_TIMEOUT_MS as string | undefined, 15 * 1000);
