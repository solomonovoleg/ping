import {
  SITE_REFERRAL_DOCUMENT_TITLE,
  SITE_REFERRAL_META_DESCRIPTION,
} from "./referral-seo-defaults";

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escTitleText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

/**
 * Заменяет title и основные meta/og/twitter для превью ссылок с пригласительным кодом.
 */
export function applyReferralSeoToIndexHtml(html: string): string {
  const t = escTitleText(SITE_REFERRAL_DOCUMENT_TITLE);
  const ta = escAttr(SITE_REFERRAL_DOCUMENT_TITLE);
  const d = escAttr(SITE_REFERRAL_META_DESCRIPTION);

  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(
      /<meta name="description" content="[^"]*"\s*\/>/,
      `<meta name="description" content="${d}" />`,
    )
    .replace(
      /<meta property="og:title" content="[^"]*"\s*\/>/,
      `<meta property="og:title" content="${ta}" />`,
    )
    .replace(
      /<meta property="og:description" content="[^"]*"\s*\/>/,
      `<meta property="og:description" content="${d}" />`,
    )
    .replace(
      /<meta name="twitter:title" content="[^"]*"\s*\/>/,
      `<meta name="twitter:title" content="${ta}" />`,
    )
    .replace(
      /<meta name="twitter:description" content="[^"]*"\s*\/>/,
      `<meta name="twitter:description" content="${d}" />`,
    );
}
