import type { Express, Request, Response, NextFunction } from "express";
import { createToken } from "../auth/token";
import { storage } from "../storage";
import { constantTimeSecretEquals } from "../security/constant-time-secret";
import { logSecurityAuditEvent } from "../security/security-audit-log";

/** Допускаем любой UUID-формат (v4 и др.) для `users.id`. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireApiHubServiceSecret(req: Request, res: Response, next: NextFunction): void {
  const s = process.env.API_HUB_SERVICE_SECRET?.trim();
  if (!s) {
    res.status(503).json({ message: "API_HUB_SERVICE_SECRET не задан на платформе" });
    return;
  }
  const auth = req.headers.authorization;
  const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!constantTimeSecretEquals(token, s)) {
    logSecurityAuditEvent("internal_api_hub_unauthorized", {
      path: req.path,
      method: req.method,
      requestId: req.requestId ?? null,
      hasAuthorizationHeader: Boolean(auth),
    });
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

function hasBoardApiHubPrime(user: { boardApiHubPrimeCode?: string | null }): boolean {
  const c = user.boardApiHubPrimeCode;
  return typeof c === "string" && c.trim().length > 0;
}

/**
 * Выдача Bearer `pm.*` для API HUB: после OAuth партнёр держит OIDC refresh в HUB,
 * а вызовы к `/api/*` платформы идут с тем же форматом токена, что и мобильное приложение.
 * Доступ только при непустом `users.board_api_hub_prime_code` (PRIME в админке).
 */
export function registerInternalApiHubIssueBearerRoutes(app: Express): void {
  app.post(
    "/internal/api-hub/issue-user-bearer",
    requireApiHubServiceSecret,
    async (req: Request, res: Response) => {
      try {
        const userId = String(req.body?.userId ?? "").trim();
        if (!userId || !UUID_RE.test(userId)) {
          res.status(400).json({ message: "userId (UUID пользователя) обязателен" });
          return;
        }
        const user = await storage.getUser(userId);
        if (!user) {
          res.status(404).json({ message: "Пользователь не найден" });
          return;
        }
        if ((user as { deletedAt?: Date | null }).deletedAt) {
          res.status(403).json({ message: "Аккаунт удалён" });
          return;
        }
        if (user.isBlocked) {
          res.status(403).json({ message: "Аккаунт заблокирован" });
          return;
        }
        if (!hasBoardApiHubPrime(user)) {
          res.status(403).json({ message: "Нет доступа API HUB (PRIME CODE не назначен)" });
          return;
        }
        res.json({ token: createToken(userId) });
      } catch (e) {
        console.error("[internal/api-hub/issue-user-bearer]", e);
        res.status(500).json({ message: "Внутренняя ошибка" });
      }
    },
  );
}
