import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildFeedCompletionState } from "./service-feed.js";
import { buildInteractCompletionState } from "./service-interact.js";
import {
  buildLeaderboardEntries,
  buildLeaderboardPayload,
  normalizeLeaderboardLimit,
} from "./service-leaderboard.js";
import {
  baseInteractBonusXp,
  fallbackNextAvailableIso,
  parsePrimaryTapBonusRule,
  resolveFulfillAction,
} from "./service-helpers.js";
import { shouldKeepTaskXpUnchanged } from "./service-task-xp.js";
import type { EdgeCampaignRow } from "../companion/repo.js";

describe("service-feed helpers", () => {
  it("buildFeedCompletionState increases xp when primary not frozen", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const state = buildFeedCompletionState({
      tapExtra: {
        lastFedYmd: "2026-03-24",
        needs: { hunger: 40, hygiene: 60, energy: 55, comfort: 45 },
      },
      careStreakDays: 3,
      now,
      baseXp: 120,
      baseLevel: 1,
      primaryBlocked: false,
    });

    assert.equal(state.newXp, 130);
    assert.equal(state.newLevel, 1);
    assert.equal(state.streak, 4);
    assert.equal(typeof state.extraWithMetrics.lastFedYmd, "string");
  });

  it("buildFeedCompletionState does not increase xp when primary frozen", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const state = buildFeedCompletionState({
      tapExtra: { needs: { hunger: 20, hygiene: 20, energy: 20, comfort: 20 } },
      careStreakDays: 1,
      now,
      baseXp: 250,
      baseLevel: 2,
      primaryBlocked: true,
    });

    assert.equal(state.newXp, 250);
    assert.equal(state.newLevel, 2);
  });
});

describe("service-interact helpers", () => {
  it("buildInteractCompletionState applies tap rule bonus", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const state = buildInteractCompletionState({
      kind: "tap",
      tapExtra: { needs: { hunger: 60, hygiene: 60, energy: 60, comfort: 60 } },
      now,
      campaignConfigJson: {
        leaderboards: {
          primary: {
            tapRule: { enabled: true, tapsPerPoint: 1, points: 3 },
          },
        },
      },
      primaryBlocked: false,
      baseXp: 100,
      baseLevel: 1,
    });

    // tap base bonus (1) + tapRule bonus (3)
    assert.equal(state.newXp, 104);
    assert.equal(state.newLevel, 1);
    assert.equal(state.newMood === "happy" || state.newMood === "neutral" || state.newMood === "sad", true);
  });

  it("buildInteractCompletionState blocks xp when frozen", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const state = buildInteractCompletionState({
      kind: "play",
      tapExtra: { needs: { hunger: 60, hygiene: 60, energy: 60, comfort: 60 } },
      now,
      campaignConfigJson: {},
      primaryBlocked: true,
      baseXp: 205,
      baseLevel: 2,
    });

    assert.equal(state.newXp, 205);
    assert.equal(state.newLevel, 2);
  });
});

describe("service-leaderboard helpers", () => {
  it("normalizes limits into allowed range", () => {
    assert.equal(normalizeLeaderboardLimit(1), 5);
    assert.equal(normalizeLeaderboardLimit(500), 100);
    assert.equal(normalizeLeaderboardLimit(30), 30);
  });

  it("maps rows and builds payload", () => {
    const rows = [
      { xp: 200, level: 2, care_streak_days: 3, platform_user_id: "u1" },
      { xp: 150, level: 1, care_streak_days: 2, platform_user_id: "u2" },
    ];
    const entries = buildLeaderboardEntries(rows, "u2");
    assert.equal(entries.length, 2);
    assert.equal(entries[0]?.rank, 1);
    assert.equal(entries[1]?.isMe, true);

    const payload = buildLeaderboardPayload({
      edgeId: "e1",
      kind: "primary",
      frozen: false,
      totalParticipants: 10,
      myRank: 2,
      entries,
    });
    assert.equal(payload.edgeId, "e1");
    assert.equal(payload.entries[1]?.platformUserId, "u2");
  });
});

describe("service-helpers", () => {
  it("parsePrimaryTapBonusRule returns normalized tap rule", () => {
    const config = {
      leaderboards: {
        primary: { tapRule: { enabled: true, tapsPerPoint: 2, points: 5 } },
      },
    };
    const rule = parsePrimaryTapBonusRule(config);
    assert.deepEqual(rule, { tapsPerPoint: 2, points: 5 });
  });

  it("baseInteractBonusXp maps known kinds", () => {
    assert.equal(baseInteractBonusXp("tap"), 1);
    assert.equal(baseInteractBonusXp("play"), 6);
    assert.equal(baseInteractBonusXp("pet"), 5);
  });

  it("resolveFulfillAction supports only life actions", () => {
    assert.equal(resolveFulfillAction("tap"), null);
    assert.equal(resolveFulfillAction("play"), "play");
    assert.equal(resolveFulfillAction("toilet"), "toilet");
    assert.equal(resolveFulfillAction("calm"), "calm");
  });

  it("fallbackNextAvailableIso is at least now", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const next = fallbackNextAvailableIso(now);
    assert.equal(typeof next, "string");
    assert.equal(new Date(next).getTime() >= now.getTime(), true);
  });
});

describe("service-task-xp", () => {
  const baseCampaign = (overrides: Partial<EdgeCampaignRow> = {}): EdgeCampaignRow => ({
    public_id: "edge-test",
    edge_type: "character",
    title: "Campaign",
    status: "published",
    gifts_json: { templates: [] },
    leaderboard_global_enabled: true,
    leaderboard_primary_enabled: true,
    leaderboard_secondary_enabled: true,
    primary_leaderboard_frozen_at: null,
    secondary_leaderboard_frozen_at: null,
    follow_reward_enabled: false,
    creator_platform_user_id: null,
    config_json: {},
    ...overrides,
  });

  it("returns true when target leaderboard is frozen and xpDelta is non-zero", () => {
    const campaign = baseCampaign({
      primary_leaderboard_frozen_at: new Date("2026-03-20T10:00:00.000Z"),
    });
    const now = new Date("2026-03-25T10:00:00.000Z");
    assert.equal(shouldKeepTaskXpUnchanged(campaign, 5, now, "primary"), true);
  });

  it("returns false for zero xpDelta even if frozen", () => {
    const campaign = baseCampaign({
      primary_leaderboard_frozen_at: new Date("2026-03-20T10:00:00.000Z"),
    });
    const now = new Date("2026-03-25T10:00:00.000Z");
    assert.equal(shouldKeepTaskXpUnchanged(campaign, 0, now, "primary"), false);
  });
});
