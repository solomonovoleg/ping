/**
 * Слияние PATCH создателя в `config_json` кампании (без миграций — только JSON).
 */

import type { CreatorCampaignPatchBody } from "./campaign-patch-types.js";

function asObj(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}

export function mergeCreatorConfig(existing: unknown, patch: CreatorCampaignPatchBody): Record<string, unknown> {
  const base = { ...asObj(existing) };
  const comp = { ...asObj(base.companion) };

  if (patch.companionCharacter) {
    const ch = { ...asObj(comp.character) };
    if (patch.companionCharacter.assetUrl !== undefined) ch.assetUrl = patch.companionCharacter.assetUrl;
    if (patch.companionCharacter.displayName !== undefined) ch.displayName = patch.companionCharacter.displayName;
    comp.character = ch;
  }

  if (patch.companionIntroText !== undefined) {
    const t = patch.companionIntroText.trim();
    if (t) {
      comp.infoArticle = { title: "О кампании", blocks: [{ type: "paragraph", text: t }] };
    } else {
      comp.infoArticle = null;
    }
  }

  if (patch.schedule) {
    const sch = { ...asObj(base.schedule) };
    if (patch.schedule.drawSummary !== undefined) sch.drawSummary = patch.schedule.drawSummary;
    if (patch.schedule.leaderboardResetSummary !== undefined) {
      sch.leaderboardResetSummary = patch.schedule.leaderboardResetSummary;
    }
    if (patch.schedule.endsAt !== undefined) sch.endsAt = patch.schedule.endsAt;
    base.schedule = sch;
    const hint = patch.schedule.drawSummary?.trim() ?? "";
    if (hint) {
      const res = { ...asObj(comp.results) };
      res.nextDrawHint = hint;
      comp.results = res;
    }
  }

  if (patch.prizeRules) {
    const pr = { ...asObj(base.prizeRules) };
    if (patch.prizeRules.pool !== undefined) pr.pool = patch.prizeRules.pool;
    if (patch.prizeRules.method !== undefined) pr.method = patch.prizeRules.method;
    if (patch.prizeRules.topN !== undefined) {
      const n = Number(patch.prizeRules.topN);
      if (Number.isFinite(n)) pr.topN = Math.min(5000, Math.max(1, Math.floor(n)));
    }
    if (patch.prizeRules.rankingKind === "primary" || patch.prizeRules.rankingKind === "secondary") {
      pr.rankingKind = patch.prizeRules.rankingKind;
    }
    base.prizeRules = pr;
  }

  if (patch.followRewardDm) {
    const fr = { ...asObj(base.followRewardDm) };
    if (patch.followRewardDm.enabled !== undefined) fr.enabled = patch.followRewardDm.enabled;
    if (patch.followRewardDm.text !== undefined) fr.text = patch.followRewardDm.text;
    if (patch.followRewardDm.mediaUrl !== undefined) fr.mediaUrl = patch.followRewardDm.mediaUrl;
    base.followRewardDm = fr;
  }

  if (patch.pingInviteDm !== undefined) {
    if (patch.pingInviteDm === null) {
      base.pingInviteDm = null;
    } else if (patch.pingInviteDm && typeof patch.pingInviteDm === "object") {
      const pi = { ...asObj(base.pingInviteDm) };
      if (patch.pingInviteDm.template !== undefined) pi.template = patch.pingInviteDm.template;
      if (patch.pingInviteDm.codeExpiresInHours !== undefined) {
        const h = Number(patch.pingInviteDm.codeExpiresInHours);
        if (Number.isFinite(h)) pi.codeExpiresInHours = Math.min(720, Math.max(1, Math.floor(h)));
      }
      if (patch.pingInviteDm.inviteIssueMode !== undefined) {
        const m = String(patch.pingInviteDm.inviteIssueMode).trim();
        if (m === "single_per_request" || m === "one_multi_use" || m === "batch_min_count") {
          pi.inviteIssueMode = m;
          if (m !== "one_multi_use") delete pi.multiUseRegistrations;
        }
      }
      if (patch.pingInviteDm.multiUseRegistrations !== undefined) {
        const n = Number(patch.pingInviteDm.multiUseRegistrations);
        if (Number.isFinite(n)) {
          pi.multiUseRegistrations = Math.min(10_000, Math.max(2, Math.floor(n)));
        }
      }
      base.pingInviteDm = pi;
    }
  }

  if (patch.taskPresets) {
    const tp = { ...asObj(base.taskPresets) };
    if (patch.taskPresets.game !== undefined) tp.game = patch.taskPresets.game;
    if (patch.taskPresets.global !== undefined) tp.global = patch.taskPresets.global;
    if (patch.taskPresets.commercial !== undefined) tp.commercial = patch.taskPresets.commercial;
    base.taskPresets = tp;
  }

  if (patch.displayAudience !== undefined) {
    const v = String(patch.displayAudience).toLowerCase().trim();
    if (v === "self" || v === "followers" || v === "public") {
      base.displayAudience = v;
    }
  }

  if (patch.companionLifeSimulation !== undefined) {
    if (patch.companionLifeSimulation === null) {
      delete comp.lifeSimulation;
    } else {
      const p = patch.companionLifeSimulation;
      const prev = asObj(comp.lifeSimulation);
      const lrPrev = asObj(prev.lifeRating);
      const ivPrev = asObj(prev.intervalsHours);
      const lrIn = asObj(p.lifeRating);
      const ivIn = asObj(p.intervalsHours);
      const lifeRating = {
        ...(typeof prev.lifeRating === "object" && prev.lifeRating !== null ? lrPrev : {}),
        ...(p.lifeRating !== undefined ? lrIn : {}),
      };
      const intervalsHours = {
        ...(typeof prev.intervalsHours === "object" && prev.intervalsHours !== null ? ivPrev : {}),
        ...(p.intervalsHours !== undefined ? ivIn : {}),
      };
      const next: Record<string, unknown> = { ...prev };
      if (p.enabled !== undefined) next.enabled = p.enabled;
      if (p.lifeRating !== undefined) next.lifeRating = lifeRating;
      if (p.intervalsHours !== undefined) next.intervalsHours = intervalsHours;
      if (p.responseWindowHours !== undefined) next.responseWindowHours = p.responseWindowHours;
      if (p.onTimeBonus !== undefined) next.onTimeBonus = p.onTimeBonus;
      if (p.missedPenalty !== undefined) next.missedPenalty = p.missedPenalty;
      if (p.queueFulfillBonus !== undefined) next.queueFulfillBonus = p.queueFulfillBonus;
      if (p.maxMoodBonus !== undefined) next.maxMoodBonus = p.maxMoodBonus;
      if (p.maxQueuePerKind !== undefined) next.maxQueuePerKind = p.maxQueuePerKind;
      comp.lifeSimulation = next;
    }
  }

  if (
    patch.leaderboardPrimaryEnabled !== undefined ||
    patch.leaderboardSecondaryEnabled !== undefined
  ) {
    const lbs = { ...asObj(base.leaderboards) };
    if (patch.leaderboardPrimaryEnabled !== undefined) {
      const prim = { ...asObj(lbs.primary) };
      prim.enabled = patch.leaderboardPrimaryEnabled;
      lbs.primary = prim;
    }
    if (patch.leaderboardSecondaryEnabled !== undefined) {
      const sec = { ...asObj(lbs.secondary) };
      sec.enabled = patch.leaderboardSecondaryEnabled;
      lbs.secondary = sec;
    }
    base.leaderboards = lbs;
  }

  if (
    patch.leaderboardPrimaryPrizeDrawRankingFreezeLifted === true ||
    patch.leaderboardSecondaryPrizeDrawRankingFreezeLifted === true
  ) {
    const lbs = { ...asObj(base.leaderboards) };
    if (patch.leaderboardPrimaryPrizeDrawRankingFreezeLifted === true) {
      const prim = { ...asObj(lbs.primary) };
      prim.prizeDrawRankingFreezeLifted = true;
      lbs.primary = prim;
    }
    if (patch.leaderboardSecondaryPrizeDrawRankingFreezeLifted === true) {
      const sec = { ...asObj(lbs.secondary) };
      sec.prizeDrawRankingFreezeLifted = true;
      lbs.secondary = sec;
    }
    base.leaderboards = lbs;
  }

  base.companion = comp;
  return base;
}

export function buildDefaultCreatorConfig(): Record<string, unknown> {
  return {
    companion: {
      surfaceOrder: ["tasks", "character", "info", "leaderboard", "results", "prizes"],
      character: { assetUrl: "", displayName: "" },
      infoArticle: null,
      results: null,
      lifeSimulation: { enabled: false },
    },
    prizeRules: { pool: "all", method: "random", topN: 50, rankingKind: "primary" },
    schedule: { drawSummary: "", leaderboardResetSummary: "", endsAt: null },
    followRewardDm: { enabled: false, text: "", mediaUrl: null },
    pingInviteDm: { template: "", codeExpiresInHours: 168, inviteIssueMode: "batch_min_count" },
    taskPresets: { game: [], global: [], commercial: [] },
    displayAudience: "public",
  };
}
