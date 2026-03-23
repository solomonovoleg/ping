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

export type FeedSnapshotConfig = {
  /** Читать готовый порядок из feed_global_snapshot (если свежий и совпадает algo). */
  snapshotReadEnabled: boolean;
  /** Максимальный возраст снапшота для использования в API (сек). */
  snapshotMaxAgeSec: number;
};

function boolEnv(name: string, defaultTrue: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return defaultTrue;
  const v = raw.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  return defaultTrue;
}

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

const snapshotDefaults: FeedSnapshotConfig = {
  snapshotReadEnabled: boolEnv("FEED_SNAPSHOT_READ_ENABLED", true),
  snapshotMaxAgeSec: Math.max(30, numEnv("FEED_SNAPSHOT_MAX_AGE_SEC", 180)),
};

let snapshotRuntime: FeedSnapshotConfig = { ...snapshotDefaults };

export function getFeedSnapshotConfig(): FeedSnapshotConfig {
  return { ...snapshotRuntime };
}

export function setFeedSnapshotConfig(next: Partial<FeedSnapshotConfig>): FeedSnapshotConfig {
  snapshotRuntime = { ...snapshotRuntime, ...next };
  return getFeedSnapshotConfig();
}

