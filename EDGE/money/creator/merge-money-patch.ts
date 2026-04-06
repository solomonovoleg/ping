import type { CreatorCampaignPatchBody } from "../../creator/campaign-patch-types.js";
import { parseMoneyConfigFromRoot } from "../config/parse-money-config.js";
import type {
  MoneyColorScheme,
  MoneyInviteDmConfig,
  MoneyPrizeTier,
  MoneyScoringKind,
  MoneyScoringRule,
} from "../types/money-config.js";
import { MONEY_COLOR_SCHEMES } from "../types/money-config.js";

const KINDS = new Set<MoneyScoringKind>([
  "invite_friend",
  "chat_messages",
  "video_call_minutes",
  "follow_creator",
  "post_created",
  "profile_likes_received",
]);

function clampStr(s: string, max: number): string {
  return s.trim().slice(0, max);
}

function normalizeScoringRule(
  raw: Record<string, unknown>,
  index: number,
): MoneyScoringRule | null {
  const id = typeof raw.id === "string" && raw.id.trim() ? clampStr(raw.id, 128) : `rule_${index + 1}`;
  const kind = raw.kind;
  if (typeof kind !== "string" || !KINDS.has(kind as MoneyScoringKind)) return null;
  const threshold = Number(raw.threshold);
  const points = Number(raw.points);
  if (!Number.isFinite(threshold) || threshold < 1) return null;
  if (!Number.isFinite(points) || points < 0) return null;
  const mpdRaw = raw.maxPointsPerDay;
  let maxPointsPerDay: number | undefined;
  if (mpdRaw !== undefined && mpdRaw !== null) {
    const m = Number(mpdRaw);
    if (Number.isFinite(m) && m >= 0) {
      maxPointsPerDay = Math.min(1_000_000, Math.floor(m));
    }
  }
  const base = {
    id,
    kind: kind as MoneyScoringKind,
    threshold: Math.min(1_000_000, Math.floor(threshold)),
    points: Math.min(1_000_000, Math.floor(points)),
    enabled: raw.enabled !== false,
  };
  return maxPointsPerDay !== undefined ? { ...base, maxPointsPerDay } : base;
}

function normalizePrizeTier(raw: Record<string, unknown>, index: number): MoneyPrizeTier | null {
  const id = typeof raw.id === "string" && raw.id.trim() ? clampStr(raw.id, 128) : `tier_${index + 1}`;
  const fr = Math.floor(Number(raw.fromRank));
  const tr = Math.floor(Number(raw.toRank));
  if (!Number.isFinite(fr) || !Number.isFinite(tr) || fr < 1 || tr < fr) return null;
  const label = typeof raw.label === "string" ? clampStr(raw.label, 200) : "";
  if (!label) return null;
  const templateKey =
    typeof raw.templateKey === "string" && raw.templateKey.trim()
      ? clampStr(raw.templateKey, 128)
      : undefined;
  return { id, fromRank: fr, toRank: tr, label, templateKey };
}

/**
 * Вливает `patch.moneyConfig` в `config_json` (после `mergeCreatorConfig`).
 */
export function mergeMoneyConfigPatch(
  existingConfig: Record<string, unknown>,
  patch: NonNullable<CreatorCampaignPatchBody["moneyConfig"]>,
): Record<string, unknown> {
  const base = parseMoneyConfigFromRoot(existingConfig);
  const p = patch;
  const next = { ...base };

  if (p.headline !== undefined) {
    next.headline = clampStr(typeof p.headline === "string" ? p.headline : "", 500);
  }
  if (p.mediaUrl !== undefined) {
    if (p.mediaUrl === null || p.mediaUrl === "") {
      next.mediaUrl = null;
    } else if (typeof p.mediaUrl === "string" && p.mediaUrl.trim()) {
      next.mediaUrl = clampStr(p.mediaUrl, 2048);
    }
  }
  if (p.scoringRules !== undefined) {
    if (!Array.isArray(p.scoringRules)) {
      next.scoringRules = [];
    } else {
      const out: MoneyScoringRule[] = [];
      p.scoringRules.forEach((x, i) => {
        if (!x || typeof x !== "object" || Array.isArray(x)) return;
        const r = normalizeScoringRule(x as Record<string, unknown>, i);
        if (r) out.push(r);
      });
      next.scoringRules = out;
    }
  }
  if (p.prizeTiers !== undefined) {
    if (!Array.isArray(p.prizeTiers)) {
      next.prizeTiers = [];
    } else {
      const out: MoneyPrizeTier[] = [];
      p.prizeTiers.forEach((x, i) => {
        if (!x || typeof x !== "object" || Array.isArray(x)) return;
        const t = normalizePrizeTier(x as Record<string, unknown>, i);
        if (t) out.push(t);
      });
      next.prizeTiers = out;
    }
  }
  if (p.inviteDm !== undefined) {
    if (p.inviteDm === null) {
      delete next.inviteDm;
    } else if (p.inviteDm && typeof p.inviteDm === "object") {
      const t = typeof p.inviteDm.template === "string" ? clampStr(p.inviteDm.template, 8000) : "";
      const h = Number(p.inviteDm.codeExpiresInHours);
      const prevH = next.inviteDm?.codeExpiresInHours;
      let codeExpiresInHours = Number.isFinite(h)
        ? Math.min(720, Math.max(1, Math.floor(h)))
        : typeof prevH === "number" && Number.isFinite(prevH)
          ? Math.min(720, Math.max(1, Math.floor(prevH)))
          : 168;
      const dm: MoneyInviteDmConfig = {
        template: t || next.inviteDm?.template || "",
        codeExpiresInHours,
      };
      if (dm.template) next.inviteDm = dm;
      else delete next.inviteDm;
    }
  }

  if (p.colorScheme !== undefined) {
    const raw = typeof p.colorScheme === "string" ? p.colorScheme.trim() : "";
    next.colorScheme = MONEY_COLOR_SCHEMES.includes(raw as MoneyColorScheme)
      ? (raw as MoneyColorScheme)
      : "default";
  }

  return { ...existingConfig, money: next };
}
