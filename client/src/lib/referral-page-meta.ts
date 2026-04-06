import {
  SITE_REFERRAL_DOCUMENT_TITLE,
  SITE_REFERRAL_META_DESCRIPTION,
} from "@shared/referral-seo-defaults";
import {
  SITE_DOCUMENT_TITLE,
  SITE_META_DESCRIPTION,
} from "@/lib/site-seo-defaults";

function setMetaContent(selector: string, content: string): void {
  const el = document.querySelector<HTMLMetaElement>(selector);
  if (el) el.setAttribute("content", content);
}

/** Вкладка и meta/og/twitter под ссылку с ?ref= */
export function setReferralInvitePageMeta(): void {
  document.title = SITE_REFERRAL_DOCUMENT_TITLE;
  setMetaContent('meta[name="description"]', SITE_REFERRAL_META_DESCRIPTION);
  setMetaContent('meta[property="og:title"]', SITE_REFERRAL_DOCUMENT_TITLE);
  setMetaContent('meta[property="og:description"]', SITE_REFERRAL_META_DESCRIPTION);
  setMetaContent('meta[name="twitter:title"]', SITE_REFERRAL_DOCUMENT_TITLE);
  setMetaContent('meta[name="twitter:description"]', SITE_REFERRAL_META_DESCRIPTION);
}

export function restoreDefaultSitePageMeta(): void {
  document.title = SITE_DOCUMENT_TITLE;
  setMetaContent('meta[name="description"]', SITE_META_DESCRIPTION);
  setMetaContent('meta[property="og:title"]', SITE_DOCUMENT_TITLE);
  setMetaContent('meta[property="og:description"]', SITE_META_DESCRIPTION);
  setMetaContent('meta[name="twitter:title"]', SITE_DOCUMENT_TITLE);
  setMetaContent('meta[name="twitter:description"]', SITE_META_DESCRIPTION);
}
