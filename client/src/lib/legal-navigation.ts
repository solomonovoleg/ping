import { getPrivacyPolicyUrl, getTermsOfUseUrl } from "./legal";

export type LegalNavResult =
  | { mode: "internal"; path: "/privacy" | "/terms" }
  | { mode: "external"; href: string };

/**
 * Если URL политики/условий указывает на тот же origin, что и приложение, открываем через роутер (Capacitor / SPA).
 * Иначе — внешняя ссылка (отдельный хост или зеркало из env).
 */
export function resolveLegalNavigation(kind: "privacy" | "terms"): LegalNavResult {
  const href = kind === "privacy" ? getPrivacyPolicyUrl() : getTermsOfUseUrl();
  if (typeof window === "undefined") {
    return { mode: "external", href };
  }
  try {
    const absolute = new URL(href, window.location.href);
    const path = absolute.pathname.replace(/\/$/, "") || "/";
    if (absolute.origin === window.location.origin && (path === "/privacy" || path === "/terms")) {
      return { mode: "internal", path };
    }
  } catch {
    /* invalid URL — treat as external string */
  }
  return { mode: "external", href };
}
