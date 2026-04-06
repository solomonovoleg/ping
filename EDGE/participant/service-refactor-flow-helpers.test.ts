import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCooldownOutcome,
  resolveInteractCooldownOutcome,
} from "./service-interact-cooldown.js";
import { applyInteractTapOutcome } from "./service-interact-tap.js";
import { buildFeedCompletionUpdate } from "./service-feed-completion.js";
import { buildCampaignLeaderboardPayload } from "./service-leaderboard-flow.js";
import { buildInteractCompletionUpdate } from "./service-interact-completion.js";
import { buildPartialProgressParams } from "./service-partial-progress-input.js";
import { resolvePlayAccessState } from "./service-play-access.js";
import { buildSimulationSnapshot } from "./service-simulation.js";
import type { EdgeCampaignRow } from "../companion/repo.js";
import type { ParticipantRow } from "./repo.js";

describe("service-interact-flow", () => {
  it("buildCooldownOutcome uses explicit nextAvailableAt when provided", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const next = "2026-03-25T10:05:00.000Z";
    const out = buildCooldownOutcome("tap", now, next);
    assert.equal(out.ok, false);
    assert.equal(out.code, "cooldown");
    assert.equal(out.kind, "tap");
    assert.equal(out.nextAvailableAt, next);
  });

  it("buildCooldownOutcome falls back to future iso when next is null", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildCooldownOutcome("play", now, null);
    assert.equal(out.ok, false);
    assert.equal(out.code, "cooldown");
    assert.equal(out.kind, "play");
    assert.equal(new Date(out.nextAvailableAt).getTime() >= now.getTime(), true);
  });

  it("resolveInteractCooldownOutcome returns cooldown for fresh play timestamp", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = resolveInteractCooldownOutcome({ lastPlayAt: now.toISOString() }, "play", now);
    assert.equal(out?.ok, false);
    assert.equal(out?.code, "cooldown");
    assert.equal(out?.kind, "play");
  });

  it("resolveInteractCooldownOutcome returns null for tap", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = resolveInteractCooldownOutcome({ lastTapAt: now.toISOString() }, "tap", now);
    assert.equal(out, null);
  });
});

describe("service-interact-tap", () => {
  it("applies tap timestamp and intro counter for tap kind", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = applyInteractTapOutcome({}, "tap", now);
    assert.equal(out.completed, true);
    assert.equal(typeof out.extra.lastTapAt, "string");
    assert.equal(out.extra.edgeIntroTapCount, 1);
  });

  it("increments play progress and stamps lastPlayAt", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = applyInteractTapOutcome({}, "play", now);
    assert.equal(typeof out.extra.lastPlayAt, "string");
    assert.equal(out.progress.play >= 1, true);
  });
});

describe("service-feed-completion", () => {
  it("adds feed xp and keeps mood shape when primary not frozen", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildFeedCompletionUpdate({
      tapExtra: {
        lastFedYmd: "2026-03-24",
        needs: { hunger: 40, hygiene: 60, energy: 55, comfort: 45 },
      },
      careStreakDays: 3,
      now,
      baseXp: 120,
      baseLevel: 1,
      primaryBlocked: false,
      campaignConfigJson: {},
      prevMood: "neutral",
    });
    assert.equal(out.xp, 130);
    assert.equal(out.level, 1);
    assert.equal(out.streak, 4);
    assert.equal(out.mood === "happy" || out.mood === "neutral" || out.mood === "sad", true);
  });

  it("keeps xp unchanged when primary frozen", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildFeedCompletionUpdate({
      tapExtra: { needs: { hunger: 20, hygiene: 20, energy: 20, comfort: 20 } },
      careStreakDays: 1,
      now,
      baseXp: 250,
      baseLevel: 2,
      primaryBlocked: true,
      campaignConfigJson: {},
      prevMood: "sad",
    });
    assert.equal(out.xp, 250);
    assert.equal(out.level, 2);
  });
});

describe("service-leaderboard-flow", () => {
  const baseCampaign = (overrides: Partial<EdgeCampaignRow> = {}): EdgeCampaignRow => ({
    public_id: "edge-flow",
    edge_type: "character",
    title: "Flow Campaign",
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

  it("builds payload and marks me entry", () => {
    const payload = buildCampaignLeaderboardPayload({
      edgeId: "e-flow",
      platformUserId: "u2",
      kind: "primary",
      campaign: baseCampaign(),
      rows: [
        { xp: 200, level: 2, care_streak_days: 3, platform_user_id: "u1" },
        { xp: 150, level: 1, care_streak_days: 2, platform_user_id: "u2" },
      ],
      totalParticipants: 10,
      myRank: 2,
      now: new Date("2026-03-25T10:00:00.000Z"),
    });
    assert.equal(payload.edgeId, "e-flow");
    assert.equal(payload.entries.length, 2);
    assert.equal(payload.entries[1]?.isMe, true);
    assert.equal(payload.frozen, false);
  });

  it("respects frozen state from campaign schedule", () => {
    const payload = buildCampaignLeaderboardPayload({
      edgeId: "e-flow",
      platformUserId: "u1",
      kind: "primary",
      campaign: baseCampaign({
        gifts_json: {
          templates: [{ key: "g", title: "Gift", drawAt: "2026-01-01T00:00:00.000Z", leaderboardScopes: ["primary"] }],
        },
      }),
      rows: [{ xp: 200, level: 2, care_streak_days: 3, platform_user_id: "u1" }],
      totalParticipants: 1,
      myRank: 1,
      now: new Date("2026-03-25T10:00:00.000Z"),
    });
    assert.equal(payload.frozen, true);
  });
});

describe("service-interact-completion", () => {
  it("applies interact xp when primary not frozen", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildInteractCompletionUpdate({
      kind: "play",
      tapExtra: { needs: { hunger: 60, hygiene: 60, energy: 60, comfort: 60 } },
      now,
      campaignConfigJson: {},
      primaryBlocked: false,
      baseXp: 200,
      baseLevel: 2,
      prevMood: "neutral",
    });
    assert.equal(out.xp, 206);
    assert.equal(out.level, 2);
    assert.equal(out.mood === "happy" || out.mood === "neutral" || out.mood === "sad", true);
  });

  it("keeps xp unchanged when primary frozen", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildInteractCompletionUpdate({
      kind: "play",
      tapExtra: { needs: { hunger: 60, hygiene: 60, energy: 60, comfort: 60 } },
      now,
      campaignConfigJson: {},
      primaryBlocked: true,
      baseXp: 205,
      baseLevel: 2,
      prevMood: "neutral",
    });
    assert.equal(out.xp, 205);
    assert.equal(out.level, 2);
  });
});

describe("service-partial-progress-input", () => {
  it("builds persist params and derives participantId from participant", () => {
    const participant: ParticipantRow = {
      id: "p1",
      campaign_public_id: "e1",
      platform_user_id: "u1",
      joined_at: new Date("2026-03-20T10:00:00.000Z"),
      money_tracking_started_at: null,
    };
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildPartialProgressParams({
      now,
      edgeId: "e1",
      platformUserId: "u1",
      participant,
      campaignConfigJson: {},
      xp: 120,
      happy: 45,
      mood: "neutral",
      level: 1,
      extra: { foo: "bar" },
    });
    assert.equal(out.participantId, "p1");
    assert.equal(out.participant.id, "p1");
    assert.equal(out.edgeId, "e1");
    assert.equal(out.platformUserId, "u1");
    assert.equal(out.xp, 120);
    assert.equal(out.mood, "neutral");
  });
});

describe("service-play-access", () => {
  it("returns null when pool is missing", () => {
    assert.equal(resolvePlayAccessState(false, false), null);
  });

  it("returns locked when campaign is locked", () => {
    assert.equal(resolvePlayAccessState(true, true), "locked");
  });

  it("returns ok when pool exists and campaign is unlocked", () => {
    assert.equal(resolvePlayAccessState(true, false), "ok");
  });
});

describe("service-simulation", () => {
  it("builds defaults from non-object extra", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildSimulationSnapshot(null, now);
    assert.equal(out.happy, 72);
    assert.equal(out.mood, "happy");
    assert.equal(out.activeNeed, null);
    assert.equal(typeof out.extra.lastSimulatedAt, "string");
  });

  it("keeps needs when simulated at the same timestamp", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildSimulationSnapshot(
      {
        lastSimulatedAt: now.toISOString(),
        needs: { hunger: 50, hygiene: 50, energy: 50, comfort: 50 },
      },
      now,
    );
    assert.deepEqual(out.needs, { hunger: 50, hygiene: 50, energy: 50, comfort: 50 });
    assert.equal(out.happy, 50);
    assert.equal(out.mood, "neutral");
  });
});
