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

  base.companion = comp;
  return base;
}

export function buildDefaultCreatorConfig(): Record<string, unknown> {
  return {
    companion: {
      surfaceOrder: ["character", "info", "leaderboard", "results", "prizes"],
      character: { assetUrl: "", displayName: "" },
      infoArticle: null,
      results: null,
    },
    prizeRules: { pool: "all", method: "random", topN: 50 },
    schedule: { drawSummary: "", leaderboardResetSummary: "", endsAt: null },
    followRewardDm: { enabled: false, text: "", mediaUrl: null },
    pingInviteDm: { template: "", codeExpiresInHours: 168 },
    taskPresets: { game: [], global: [], commercial: [] },
  };
}
