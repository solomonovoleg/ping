/**
 * Ссылки для App Store / Google Play: политика, условия использования, поддержка.
 * Задаются через VITE_PRIVACY_POLICY_URL, VITE_TERMS_OF_USE_URL и VITE_SUPPORT_EMAIL при сборке.
 */

const baseUrl =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/$/, "")
    : "https://pingos.ru";

export function getPrivacyPolicyUrl(): string {
  const url =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_PRIVACY_POLICY_URL
      ? String(import.meta.env.VITE_PRIVACY_POLICY_URL).trim()
      : "";
  return url || `${baseUrl}/privacy`;
}

export function getTermsOfUseUrl(): string {
  const url =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_TERMS_OF_USE_URL
      ? String(import.meta.env.VITE_TERMS_OF_USE_URL).trim()
      : "";
  return url || `${baseUrl}/terms`;
}

export function getSupportEmail(): string {
  const email =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPPORT_EMAIL
      ? String(import.meta.env.VITE_SUPPORT_EMAIL).trim()
      : "";
  return email || "support@pingos.ru";
}
