type SecurityAuditLevel = "warn" | "error" | "info";
type SecurityAuditCategory = "auth" | "csrf" | "abuse" | "uploads" | "webhook" | "internal" | "general";

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length <= 180) return value;
    return `${value.slice(0, 180)}...[${value.length} chars]`;
  }
  if (Array.isArray(value)) return value.slice(0, 10).map((v) => redact(v));
  if (typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) {
      if (/password|token|secret|authorization|cookie|api[-_]?key/i.test(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

export function logSecurityAuditEvent(
  event: string,
  details?: Record<string, unknown>,
  level: SecurityAuditLevel = "warn",
  category: SecurityAuditCategory = "general",
): void {
  if (process.env.SECURITY_AUDIT_DISABLED === "1") return;
  const payload = details ? JSON.stringify(redact(details)) : "{}";
  const line = `[security-audit] level=${level} category=${category} event=${event} details=${payload}`;
  if (level === "info") {
    console.info(line);
    return;
  }
  if (level === "error") {
    console.error(line);
    return;
  }
  console.warn(line);
}
