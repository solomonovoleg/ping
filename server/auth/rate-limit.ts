import type { Request, RequestHandler } from "express";
import rateLimit from "express-rate-limit";

const passthrough: RequestHandler = (_req, _res, next) => next();

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function createLimiter(windowMs: number, max: number, message: string): RequestHandler {
  return createLimiterWithKey(windowMs, max, message);
}

function requestIp(req: Request): string {
  return (req.ip || "unknown").trim() || "unknown";
}

function createLimiterWithKey(
  windowMs: number,
  max: number,
  message: string,
  keyGenerator?: (req: Request) => string,
): RequestHandler {
  if (process.env.RATE_LIMIT_DISABLED === "1") return passthrough;
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyGenerator ?? ((req) => requestIp(req)),
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === "1",
    message: { message },
  });
}

export const loginLimiter = createLimiterWithKey(
  envNumber("RATE_LIMIT_LOGIN_WINDOW_MS", 5 * 60 * 1000),
  envNumber("RATE_LIMIT_LOGIN_MAX", 10),
  "Слишком много попыток входа. Повторите позже.",
  (req) => {
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    return `${requestIp(req)}|${phone.slice(0, 20)}`;
  },
);

export const registerLimiter = createLimiterWithKey(
  envNumber("RATE_LIMIT_REGISTER_WINDOW_MS", 15 * 60 * 1000),
  envNumber("RATE_LIMIT_REGISTER_MAX", 10),
  "Слишком много попыток регистрации. Повторите позже.",
  (req) => {
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    return `${requestIp(req)}|${phone.slice(0, 20)}`;
  },
);

export const contactsPhoneMatchLimiter = createLimiterWithKey(
  envNumber("RATE_LIMIT_CONTACTS_MATCH_WINDOW_MS", 10 * 60 * 1000),
  envNumber("RATE_LIMIT_CONTACTS_MATCH_MAX", 20),
  "Слишком много запросов сопоставления контактов. Повторите позже.",
  (req) => `${requestIp(req)}|${String((req.session as { userId?: string } | undefined)?.userId ?? "-")}`,
);

export const profilePatchLimiter = createLimiter(
  envNumber("RATE_LIMIT_PROFILE_PATCH_WINDOW_MS", 5 * 60 * 1000),
  envNumber("RATE_LIMIT_PROFILE_PATCH_MAX", 30),
  "Слишком много изменений профиля. Повторите позже.",
);

export const dataExportLimiter = createLimiter(
  envNumber("RATE_LIMIT_DATA_EXPORT_WINDOW_MS", 60 * 60 * 1000),
  envNumber("RATE_LIMIT_DATA_EXPORT_MAX", 3),
  "Слишком много запросов выгрузки данных. Повторите позже.",
);

export const linkPreviewLimiter = createLimiter(
  envNumber("RATE_LIMIT_LINK_PREVIEW_WINDOW_MS", 60 * 1000),
  envNumber("RATE_LIMIT_LINK_PREVIEW_MAX", 60),
  "Слишком много запросов предпросмотра ссылок. Повторите позже.",
);

export const dmByPublicIdLimiter = createLimiter(
  envNumber("RATE_LIMIT_DM_BY_PUBLIC_ID_WINDOW_MS", 5 * 60 * 1000),
  envNumber("RATE_LIMIT_DM_BY_PUBLIC_ID_MAX", 50),
  "Слишком много запросов. Повторите позже.",
);

export const referralsCheckLimiter = createLimiter(
  envNumber("RATE_LIMIT_REFERRALS_CHECK_WINDOW_MS", 10 * 60 * 1000),
  envNumber("RATE_LIMIT_REFERRALS_CHECK_MAX", 60),
  "Слишком много проверок кода приглашения. Повторите позже.",
);

/** Опрос «звонок уже подтверждён?» при сбросе пароля — чаще, чем loginLimiter. */
export const passwordResetPollLimiter = createLimiterWithKey(
  envNumber("RATE_LIMIT_PASSWORD_RESET_POLL_WINDOW_MS", 10 * 60 * 1000),
  envNumber("RATE_LIMIT_PASSWORD_RESET_POLL_MAX", 200),
  "Слишком много запросов проверки. Подождите или нажмите «Продолжить».",
  (req) => {
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    const cid = typeof req.body?.challengeId === "string" ? req.body.challengeId.trim() : "";
    return `${requestIp(req)}|${phone.slice(0, 24)}|${cid.slice(0, 24)}`;
  },
);
