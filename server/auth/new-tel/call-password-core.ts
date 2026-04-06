/**
 * Общий клиент New-Tel CallPassword + опрос статуса звонка.
 * Сценарии signup / сброс пароля — в `call-password-signup-verify.ts` и `call-password-reset-verify.ts`.
 */
import { createHash } from "crypto";
import { insertNewTelCallPasswordLogRow } from "./new-tel-call-password-log.repo";

export const NEW_TEL_REQUEST_TIMEOUT_MS = 12_000;
export const STATUS_POLL_ATTEMPTS = 10;
export const STATUS_POLL_INTERVAL_MS = 1000;

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const VERIFIED_TICKET_TTL_MS = 15 * 60 * 1000;
export const MAX_CONFIRM_ATTEMPTS = 5;

const NEW_TEL_API_DEFAULT = "https://api.new-tel.net";

const SUCCESS_STATUS = "success";
const SUCCESS_RESULT = "success";

export type GetPasswordCallStatusResponse = {
  status?: string;
  message?: string;
  data?: {
    result?: string;
    message?: string;
    callDetails?: {
      callId?: string;
      status?: string;
      reasonCode?: number;
    };
  };
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function env(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

/** Первое непустое значение (каноническое имя + частые опечатки в .env). */
function envFirst(...names: string[]): string {
  for (const name of names) {
    const v = env(name);
    if (v) return v;
  }
  return "";
}

function getNewTelApiBase(): string {
  const raw = envFirst("NEW_TEL_API_BASE", "NEWTEL_BASE_URL", "NEWTEL_API_URL").replace(/\/+$/, "");
  if (!raw) return NEW_TEL_API_DEFAULT;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return NEW_TEL_API_DEFAULT;
    return `${u.origin}`;
  } catch {
    return NEW_TEL_API_DEFAULT;
  }
}

function newTelAuthKeyRaw(): string {
  return envFirst("NEW_TEL_AUTH_KEY", "NEWTEL_AUTH_KEY");
}

function newTelSignKeyRaw(): string {
  return envFirst("NEW_TEL_SIGN_KEY", "NEWTEL_SIGN_KEY");
}

/** Ключи в ЛК New-Tel — 48 hex в нижнем регистре; в .env часто попадают кавычки или UPPERCASE → подпись не совпадает. */
function normalizeNewTelApiKey(raw: string): string {
  let v = raw.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v.toLowerCase();
}

function isExplicitlyDisabled(): boolean {
  const v = envFirst("NEW_TEL_CALL_PASSWORD_ENABLED", "NEWTEL_CALL_PASSWORD_ENABLED");
  if (!v) return false;
  const lower = v.toLowerCase();
  return lower === "0" || lower === "false" || lower === "no" || lower === "off";
}

export function hasNewTelCallPasswordKeys(): boolean {
  return Boolean(newTelAuthKeyRaw() && newTelSignKeyRaw());
}

function isEnabled(): boolean {
  if (isExplicitlyDisabled()) return false;
  const v = envFirst("NEW_TEL_CALL_PASSWORD_ENABLED", "NEWTEL_CALL_PASSWORD_ENABLED");
  const flagOn = v === "1" || v.toLowerCase() === "true";
  return flagOn || hasNewTelCallPasswordKeys();
}

function methodAuthToken(methodName: string, payloadJson: string, unixTimeSec: number): string {
  const authKey = normalizeNewTelApiKey(newTelAuthKeyRaw());
  const signKey = normalizeNewTelApiKey(newTelSignKeyRaw());
  const timeStr = String(unixTimeSec);
  const base = `${methodName}\n${timeStr}\n${authKey}\n${payloadJson}\n${signKey}`;
  const signature = createHash("sha256").update(base, "utf8").digest("hex");
  return `${authKey}${timeStr}${signature}`;
}

export function ensureNewTelCallPasswordConfigured(): void {
  if (isExplicitlyDisabled()) {
    throw new Error("Подтверждение звонком отключено на сервере (NEW_TEL_CALL_PASSWORD_ENABLED=0).");
  }
  const authKey = normalizeNewTelApiKey(newTelAuthKeyRaw());
  const signKey = normalizeNewTelApiKey(newTelSignKeyRaw());
  if (!authKey || !signKey) {
    throw new Error(
      "На этом сервере API не заданы ключи New-Tel. Укажите NEW_TEL_AUTH_KEY и NEW_TEL_SIGN_KEY (или NEWTEL_AUTH_KEY и NEWTEL_SIGN_KEY) в .env на VPS и перезапустите PM2.",
    );
  }
  const hex48 = /^[0-9a-f]{48}$/;
  if (!hex48.test(authKey) || !hex48.test(signKey)) {
    throw new Error(
      "Ключи New-Tel должны быть по 48 шестнадцатеричных символов (a–f, 0–9), как в личном кабинете. Проверьте .env: нет ли лишних кавычек, пробелов или перепутаны ли AUTH и SIGN.",
    );
  }
}

export function normalizeDigitsPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function isNewTelCallPasswordEnabled(): boolean {
  return isEnabled();
}

export type NewTelCallPasswordLogContext = {
  scenario: "signup" | "password_reset";
};

function redactNewTelLogPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload };
  if (typeof out.dstNumber === "string") {
    const d = out.dstNumber.replace(/\D/g, "");
    out.dstNumber = d.length >= 4 ? `***${d.slice(-4)}` : "***";
  }
  return out;
}

/** Рекурсивно убираем PIN на любом уровне вложенности (ответ New-Tel). */
function deepRedactNewTelSecrets(obj: unknown, depth = 0): unknown {
  if (depth > 14) return obj;
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((x) => deepRedactNewTelSecrets(x, depth + 1));
  if (typeof obj !== "object") return obj;
  const o = { ...(obj as Record<string, unknown>) };
  for (const key of Object.keys(o)) {
    const lower = key.toLowerCase();
    if (lower === "pin" || lower === "password") {
      const v = o[key];
      o[key] = v != null && String(v) !== "" ? "[redacted]" : v;
    } else {
      o[key] = deepRedactNewTelSecrets(o[key], depth + 1);
    }
  }
  return o;
}

function sanitizeNewTelLogResponse(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  return deepRedactNewTelSecrets({ ...(obj as Record<string, unknown>) });
}

function buildNewTelHttpExchangeDetail(p: {
  methodName: string;
  durationMs: number;
  httpStatus: number | null;
  payload: Record<string, unknown>;
  responseSanitized: unknown;
  newTelMethodExtractError: string | null;
  terminalErrorMessage: string | null;
  apiOk: boolean | null;
  rawBodySnippet: string | null;
}): Record<string, unknown> {
  const requestUrl = `${getNewTelApiBase()}/${p.methodName}`;
  const sanitized = p.responseSanitized;
  let top: Record<string, unknown> | null = null;
  let dataLayer: unknown = null;
  let callDetails: unknown = null;
  if (sanitized && typeof sanitized === "object") {
    const s = sanitized as Record<string, unknown>;
    top = {
      status: s.status ?? null,
      message: s.message ?? null,
    };
    if (s.data && typeof s.data === "object") {
      const d = s.data as Record<string, unknown>;
      dataLayer = {
        result: d.result ?? null,
        message: d.message ?? null,
      };
      callDetails = d.callDetails ?? null;
    }
  }
  return {
    kind: "http_exchange",
    transport: {
      requestUrl,
      httpMethod: "POST",
      durationMs: p.durationMs,
      httpStatus: p.httpStatus,
    },
    outgoing: {
      bodyRedacted: redactNewTelLogPayload(p.payload),
    },
    incoming: {
      httpStatus: p.httpStatus,
      topLevel: top,
      data: dataLayer,
      callDetails,
      fullResponseSanitizedTree: sanitized,
      rawBodySnippetUtf8: p.rawBodySnippet,
    },
    outcome: {
      apiOk: p.apiOk,
      newTelEnvelopeError: p.newTelMethodExtractError,
      terminalMessage: p.terminalErrorMessage,
    },
  };
}

export async function callNewTelPasswordApi<T>(
  methodName: string,
  payload: Record<string, unknown>,
  logCtx?: NewTelCallPasswordLogContext | null,
): Promise<T> {
  ensureNewTelCallPasswordConfigured();
  const unixTimeSec = Math.floor(Date.now() / 1000);
  const payloadJson = JSON.stringify(payload);
  const token = methodAuthToken(methodName, payloadJson, unixTimeSec);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NEW_TEL_REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  let httpStatus: number | null = null;
  let apiOk: boolean | null = null;
  let errMsg: string | null = null;
  let responseSanitized: unknown = null;
  let newTelMethodExtractError: string | null = null;
  let rawBodySnippet: string | null = null;
  try {
    const res = await fetch(`${getNewTelApiBase()}/${methodName}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: payloadJson,
      signal: controller.signal,
    });
    httpStatus = res.status;
    const text = await res.text();
    if (text) {
      rawBodySnippet = text.length > 8000 ? `${text.slice(0, 8000)}… [truncated ${text.length} chars]` : text;
    }
    let json: T | null = null;
    try {
      json = text ? (JSON.parse(text) as T) : null;
    } catch {
      errMsg = text ? text.slice(0, 240) : `New-Tel: пустой ответ (HTTP ${res.status})`;
      throw new Error(errMsg);
    }
    if (!json || typeof json !== "object") {
      errMsg = "Неверный ответ от New-Tel.";
      throw new Error(errMsg);
    }
    responseSanitized = sanitizeNewTelLogResponse(json);
    const methodErr = extractNewTelMethodError(json as Parameters<typeof extractNewTelMethodError>[0]);
    newTelMethodExtractError = methodErr || null;
    apiOk = !methodErr;
    errMsg = methodErr || null;
    if (!res.ok) {
      const body = json as unknown as { message?: string };
      const msg = typeof body.message === "string" ? body.message : `New-Tel: HTTP ${res.status}`;
      errMsg = msg;
      apiOk = false;
      throw new Error(msg);
    }
    return json;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      errMsg = "New-Tel не ответил вовремя. Попробуйте ещё раз.";
      apiOk = false;
      throw new Error(errMsg);
    }
    if (error instanceof Error && !errMsg) {
      errMsg = error.message;
    }
    if (errMsg) {
      apiOk = false;
    }
    throw error;
  } finally {
    if (logCtx) {
      const durationMs = Math.max(0, Math.round(Date.now() - startedAt));
      void insertNewTelCallPasswordLogRow({
        scenario: logCtx.scenario,
        apiMethod: methodName,
        durationMs,
        httpStatus,
        apiOk,
        errorMessage: errMsg,
        requestRedacted: redactNewTelLogPayload(payload),
        responseSanitized,
        detail: buildNewTelHttpExchangeDetail({
          methodName,
          durationMs,
          httpStatus,
          payload,
          responseSanitized,
          newTelMethodExtractError,
          terminalErrorMessage: errMsg,
          apiOk,
          rawBodySnippet: responseSanitized ? null : rawBodySnippet,
        }),
      });
    }
    clearTimeout(timeout);
  }
}

export function extractNewTelMethodError(response: {
  status?: string;
  message?: string;
  data?: { result?: string; message?: string };
}): string {
  if (response.status !== SUCCESS_STATUS) {
    return response.message || "Запрос верификации отклонён.";
  }
  if (response.data?.result !== SUCCESS_RESULT) {
    return response.data?.message || "Не удалось выполнить операцию верификации.";
  }
  return "";
}

function classifyCallDetails(d: { status?: string; reasonCode?: number } | undefined): "ok" | "bad" | "pending" {
  if (!d) return "pending";
  const status = (d.status || "").toLowerCase().trim();
  if (status === "no such number" || status === "not available") return "bad";
  if (status === "answered" || status === "busy" || status === "no answer") return "ok";
  const rc = d.reasonCode;
  if (typeof rc === "number") {
    if (rc === 0 || rc === 8) return "bad";
    if (rc === 4 || rc === 1 || rc === 3 || rc === 5) return "ok";
  }
  return "pending";
}

/**
 * Дожидается успешного статуса звонка в New-Tel. При «плохом» номере вызывает `onBad` и бросает ошибку.
 */
export async function pollNewTelPasswordCallVerified(
  callId: string,
  onBad?: () => void,
  logCtx?: NewTelCallPasswordLogContext | null,
): Promise<void> {
  let lastHint = "";
  let statusOk = false;
  for (let i = 0; i < STATUS_POLL_ATTEMPTS; i++) {
    const response = await callNewTelPasswordApi<GetPasswordCallStatusResponse>(
      "call-password/get-password-call-status",
      { callId },
      logCtx,
    );
    const methodError = extractNewTelMethodError(response);
    if (methodError) {
      lastHint = methodError;
      await sleep(STATUS_POLL_INTERVAL_MS);
      continue;
    }
    const cd = response.data?.callDetails;
    const verdict = classifyCallDetails(cd);
    if (verdict === "bad") {
      onBad?.();
      if (logCtx) {
        void insertNewTelCallPasswordLogRow({
          scenario: logCtx.scenario,
          apiMethod: "internal/poll/call-details-rejected",
          durationMs: 0,
          httpStatus: null,
          apiOk: false,
          errorMessage:
            "Номер недоступен для подтверждения звонком. Проверьте номер и запросите звонок снова.",
          requestRedacted: { callId },
          responseSanitized: sanitizeNewTelLogResponse(response),
          detail: {
            kind: "poll_call_details_rejected",
            iteration: i,
            classifierVerdict: verdict,
            callDetails: cd ?? null,
            atoms: {
              callDetailsStatus: cd?.status ?? null,
              callDetailsReasonCode: cd?.reasonCode ?? null,
            },
          },
        });
      }
      throw new Error("Номер недоступен для подтверждения звонком. Проверьте номер и запросите звонок снова.");
    }
    if (verdict === "ok") {
      statusOk = true;
      break;
    }
    await sleep(STATUS_POLL_INTERVAL_MS);
  }
  if (!statusOk) {
    const msg =
      lastHint ||
      "Звонок ещё обрабатывается. Подождите несколько секунд и снова нажмите «Подтвердить» (повтор не тратит новый звонок).";
    if (logCtx) {
      void insertNewTelCallPasswordLogRow({
        scenario: logCtx.scenario,
        apiMethod: "internal/poll/exhausted-or-still-pending",
        durationMs: 0,
        httpStatus: null,
        apiOk: false,
        errorMessage: msg,
        requestRedacted: { callId, pollAttempts: STATUS_POLL_ATTEMPTS },
        responseSanitized: null,
        detail: {
          kind: "poll_exhausted",
          iterations: STATUS_POLL_ATTEMPTS,
          lastNewTelEnvelopeHint: lastHint || null,
        },
      });
    }
    throw new Error(msg);
  }
}
