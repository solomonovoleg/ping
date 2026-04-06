import type { Request, Response, NextFunction } from "express";

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Пустой allowlist camera=() / microphone=() блокирует getUserMedia на самой странице SPA (звонки, запись).
  // (self) — разрешить захват с того же origin, что и документ.
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    // HSTS only in production behind HTTPS.
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  // API-focused baseline CSP to reduce injection impact in error pages.
  if (req.path.startsWith("/api") || req.path.startsWith("/internal")) {
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  }
  next();
}
