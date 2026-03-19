export type FeedAlgoMode = "strict_chrono" | "chrono_boost_v1";

export type FeedAlgoConfig = {
  mode: FeedAlgoMode;
  boostWindowHours: number;
  boostCapMinutes: number;
  reactionBoostMinutes: number;
  commentBoostMinutes: number;
  shareBoostMinutes: number;
  candidatePadding: number;
  candidateMin: number;
  candidateMax: number;
  // Анти-спам: коэффициент веса активности по "возрасту" аккаунта.
  veryNewAccountHours: number;
  newAccountHours: number;
  veryNewAccountFactor: number;
  newAccountFactor: number;
};

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function parseMode(raw: string | undefined): FeedAlgoMode {
  if (raw === "strict_chrono") return "strict_chrono";
  return "chrono_boost_v1";
}

const envDefaults: FeedAlgoConfig = {
  mode: parseMode(process.env.FEED_ALGO_MODE),
  boostWindowHours: Math.max(1, numEnv("FEED_BOOST_WINDOW_HOURS", 12)),
  boostCapMinutes: Math.max(0, numEnv("FEED_BOOST_CAP_MINUTES", 360)),
  reactionBoostMinutes: Math.max(0, numEnv("FEED_REACTION_BOOST_MINUTES", 3)),
  commentBoostMinutes: Math.max(0, numEnv("FEED_COMMENT_BOOST_MINUTES", 8)),
  shareBoostMinutes: Math.max(0, numEnv("FEED_SHARE_BOOST_MINUTES", 15)),
  candidatePadding: Math.max(0, numEnv("FEED_RANKING_CANDIDATE_PADDING", 180)),
  candidateMin: Math.max(50, numEnv("FEED_RANKING_CANDIDATE_MIN", 260)),
  candidateMax: Math.max(100, numEnv("FEED_RANKING_CANDIDATE_MAX", 800)),
  veryNewAccountHours: Math.max(1, numEnv("FEED_ANTISPAM_VERY_NEW_HOURS", 24)),
  newAccountHours: Math.max(1, numEnv("FEED_ANTISPAM_NEW_HOURS", 72)),
  veryNewAccountFactor: Math.min(1, Math.max(0, numEnv("FEED_ANTISPAM_VERY_NEW_FACTOR", 0.2))),
  newAccountFactor: Math.min(1, Math.max(0, numEnv("FEED_ANTISPAM_NEW_FACTOR", 0.5))),
};

let runtimeConfig: FeedAlgoConfig = { ...envDefaults };

export function getFeedAlgoConfig(): FeedAlgoConfig {
  return { ...runtimeConfig };
}

export function setFeedAlgoConfig(next: Partial<FeedAlgoConfig>): FeedAlgoConfig {
  runtimeConfig = {
    ...runtimeConfig,
    ...next,
  };
  return getFeedAlgoConfig();
}

