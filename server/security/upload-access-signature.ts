import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_TTL_SEC = 15 * 60;

function secret(): string {
  const s =
    process.env.UPLOAD_ACCESS_SECRET?.trim() ||
    process.env.AUTH_TOKEN_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim();
  if (s && s.length >= 24) return s;
  if (process.env.ALLOW_INSECURE_SECRETS === "1") return "dev-insecure-upload-access-secret-change-me";
  throw new Error(
    "[security] UPLOAD_ACCESS_SECRET (or AUTH_TOKEN_SECRET/SESSION_SECRET) must be set and at least 24 chars.",
  );
}

function signPayload(pathname: string, exp: number): string {
  const payload = `${pathname}|${exp}`;
  return createHmac("sha256", secret()).update(payload, "utf8").digest("hex");
}

export function buildSignedUploadPath(pathname: string, ttlSec = DEFAULT_TTL_SEC): string {
  const exp = Math.floor(Date.now() / 1000) + Math.max(30, ttlSec);
  const sig = signPayload(pathname, exp);
  const sep = pathname.includes("?") ? "&" : "?";
  return `${pathname}${sep}exp=${exp}&sig=${sig}`;
}

export function verifySignedUploadPath(pathname: string, expRaw: string, sigRaw: string): boolean {
  const exp = Number.parseInt(String(expRaw || "").trim(), 10);
  if (!Number.isFinite(exp) || exp <= 0) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;
  const expected = signPayload(pathname, exp);
  const left = Buffer.from(String(sigRaw || ""), "utf8");
  const right = Buffer.from(expected, "utf8");
  if (left.length !== right.length) return false;
  try {
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

/** Совместимая проверка: принимает несколько эквивалентных путей для поэтапного rollout. */
export function verifySignedUploadPathAny(
  pathnames: string[],
  expRaw: string,
  sigRaw: string,
): boolean {
  for (const pathname of pathnames) {
    if (verifySignedUploadPath(pathname, expRaw, sigRaw)) return true;
  }
  return false;
}
