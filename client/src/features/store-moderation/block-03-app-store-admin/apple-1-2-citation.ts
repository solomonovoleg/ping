/**
 * Сжатая выжимка Apple App Review Guidelines §1.2 (User-Generated Content) по состоянию на 2026.
 * Первоисточник: https://developer.apple.com/app-store/review/guidelines/#safety
 */
export const APPLE_APP_REVIEW_GUIDELINES_UGC_URL =
  "https://developer.apple.com/app-store/review/guidelines/#safety";

/** Точные пункты списка из §1.2 (до подпункта (a) про creator apps). */
export const APPLE_UGC_REQUIRED_BULLETS = [
  "A method for filtering objectionable material from being posted to the app",
  "A mechanism to report offensive content and timely responses to concerns",
  "The ability to block abusive users from the service",
  "Published contact information so users can easily reach you",
] as const;

/** Подпункт (a) — для приложений с контентом создателей и возрастными ограничениями. */
export const APPLE_UGC_CREATOR_APPS_NOTE =
  "Creator apps must provide a way for users to identify content that exceeds the app’s age rating, " +
  "and use an age restriction mechanism based on verified or declared age to limit access by underage users.";
