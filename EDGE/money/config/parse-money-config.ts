import type {
  MoneyColorScheme,
  MoneyConfigParsed,
  MoneyInviteDmConfig,
  MoneyPrizeTier,
  MoneyScoringKind,
  MoneyScoringRule,
} from "../types/money-config.js";
import { MONEY_COLOR_SCHEMES } from "../types/money-config.js";
import { asRecord } from "./as-record.js";
import { defaultMoneyConfigSection } from "./defaults.js";

const SCORING_KINDS = new Set<MoneyScoringKind>([
  "invite_friend",
  "chat_messages",
  "video_call_minutes",
  "follow_creator",
  "post_created",
  "profile_likes_received",
]);

function parseScoringRule(raw: unknown, index: number): MoneyScoringRule | null {
  const o = asRecord(raw);
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `rule_${index + 1}`;
  const kind = o.kind;
  if (typeof kind !== "string" || !SCORING_KINDS.has(kind as MoneyScoringKind)) return null;
  const threshold = Number(o.threshold);
  const points = Number(o.points);
  if (!Number.isFinite(threshold) || threshold < 1) return null;
  if (!Number.isFinite(points) || points < 0) return null;
  const enabled = o.enabled !== false;
  const mpdRaw = o.maxPointsPerDay;
  let maxPointsPerDay: number | undefined;
  if (mpdRaw !== undefined && mpdRaw !== null) {
    const m = Number(mpdRaw);
    if (Number.isFinite(m) && m >= 0) {
      maxPointsPerDay = Math.min(1_000_000, Math.floor(m));
    }
  }
  const base = { id, kind: kind as MoneyScoringKind, threshold: Math.floor(threshold), points: Math.floor(points), enabled };
  return maxPointsPerDay !== undefined ? { ...base, maxPointsPerDay } : base;
}

function parsePrizeTier(raw: unknown, index: number): MoneyPrizeTier | null {
  const o = asRecord(raw);
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `tier_${index + 1}`;
  const fromRank = Number(o.fromRank);
  const toRank = Number(o.toRank);
  if (!Number.isFinite(fromRank) || !Number.isFinite(toRank)) return null;
  const fr = Math.floor(fromRank);
  const tr = Math.floor(toRank);
  if (fr < 1 || tr < fr) return null;
  const label = typeof o.label === "string" ? o.label.trim().slice(0, 200) : "";
  if (!label) return null;
  const templateKey =
    typeof o.templateKey === "string" && o.templateKey.trim() ? o.templateKey.trim().slice(0, 128) : undefined;
  return { id, fromRank: fr, toRank: tr, label, templateKey };
}

function parseInviteDm(raw: unknown): MoneyInviteDmConfig | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const template = typeof o.template === "string" ? o.template.trim().slice(0, 8000) : "";
  const h = o.codeExpiresInHours;
  let codeExpiresInHours =
    typeof h === "number" && Number.isFinite(h) ? Math.floor(h) : 168;
  codeExpiresInHours = Math.min(720, Math.max(1, codeExpiresInHours));
  if (!template) return undefined;
  return { template, codeExpiresInHours };
}

/** Безопасный разбор `config_json.money`; при ошибке — дефолт. */
export function parseMoneyConfigFromRoot(configJson: unknown): MoneyConfigParsed {
  const root = asRecord(configJson);
  const rawMoney = root.money;
  if (!rawMoney || typeof rawMoney !== "object" || Array.isArray(rawMoney)) {
    return defaultMoneyConfigSection();
  }
  const m = asRecord(rawMoney);
  const headline = typeof m.headline === "string" ? m.headline.trim().slice(0, 500) : "";
  let mediaUrl: string | null = null;
  if (typeof m.mediaUrl === "string" && m.mediaUrl.trim()) {
    mediaUrl = m.mediaUrl.trim().slice(0, 2048);
  } else if (m.mediaUrl === null || m.mediaUrl === "") {
    mediaUrl = null;
  }
  const scoringRules: MoneyScoringRule[] = [];
  if (Array.isArray(m.scoringRules)) {
    m.scoringRules.forEach((x, i) => {
      const r = parseScoringRule(x, i);
      if (r) scoringRules.push(r);
    });
  }
  const prizeTiers: MoneyPrizeTier[] = [];
  if (Array.isArray(m.prizeTiers)) {
    m.prizeTiers.forEach((x, i) => {
      const t = parsePrizeTier(x, i);
      if (t) prizeTiers.push(t);
    });
  }
  const inviteDm = parseInviteDm(m.inviteDm);
  const rawScheme = typeof m.colorScheme === "string" ? m.colorScheme.trim() : "";
  const colorScheme: MoneyColorScheme =
    MONEY_COLOR_SCHEMES.includes(rawScheme as MoneyColorScheme)
      ? (rawScheme as MoneyColorScheme)
      : "default";
  const out: MoneyConfigParsed = {
    version: 1,
    headline,
    mediaUrl,
    scoringRules,
    prizeTiers,
    colorScheme,
  };
  if (inviteDm) out.inviteDm = inviteDm;
  return out;
}
