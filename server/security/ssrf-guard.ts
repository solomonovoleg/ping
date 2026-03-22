/**
 * Блокирует очевидные SSRF-цели для исходящего fetch с сервера (loopback, частные сети, link-local).
 * Не заменяет allowlist доверенных доменов — только базовый барьер.
 */
export function isSsrfRiskUrl(parsed: URL): boolean {
  const host = parsed.hostname.toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;

  // IPv4
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    const c = Number(ipv4[3]);
    const d = Number(ipv4[4]);
    if ([a, b, c, d].some((n) => n > 255)) return true;
    if (a === 127 || a === 0) return true;
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    return false;
  }

  // IPv6 (URL parser даёт hostname без [])
  if (host.includes(":")) {
    const h = host.replace(/^\[|\]$/g, "");
    if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true;
    const lower = h.toLowerCase();
    if (lower.startsWith("fe80:")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    if (lower.startsWith("::ffff:") && lower.includes(".")) {
      const v4 = lower.slice("::ffff:".length);
      try {
        const u = new URL(`http://${v4}`);
        return isSsrfRiskUrl(u);
      } catch {
        return true;
      }
    }
  }

  return false;
}
