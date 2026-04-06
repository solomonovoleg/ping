import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearPrizeDrawLiftIfGiftScheduleChanged,
  effectiveLeaderboardXpFrozen,
  parseGiftTemplates,
  prizeDrawScheduleFingerprintForKind,
} from "./leaderboard-draw-freeze.js";
import type { EdgeCampaignRow } from "../companion/repo.js";

describe("prizeDrawScheduleFingerprintForKind", () => {
  it("ignores gifts that do not scope to the kind", () => {
    const t = parseGiftTemplates({
      templates: [
        { key: "a", title: "A", drawAt: "2030-01-01T00:00:00.000Z", leaderboardScopes: ["primary"] },
        { key: "b", title: "B", drawAt: "2030-02-01T00:00:00.000Z", leaderboardScopes: ["secondary"] },
      ],
    });
    assert.equal(
      prizeDrawScheduleFingerprintForKind(t, "primary").includes("a"),
      true,
    );
    assert.equal(prizeDrawScheduleFingerprintForKind(t, "primary").includes("b"), false);
  });

  it("changes when drawAt of a scoped gift changes", () => {
    const oldT = parseGiftTemplates({
      templates: [{ key: "x", title: "X", drawAt: "2025-06-01T12:00:00.000Z" }],
    });
    const newT = parseGiftTemplates({
      templates: [{ key: "x", title: "X", drawAt: "2025-06-02T12:00:00.000Z" }],
    });
    assert.notEqual(
      prizeDrawScheduleFingerprintForKind(oldT, "primary"),
      prizeDrawScheduleFingerprintForKind(newT, "primary"),
    );
  });
});

describe("clearPrizeDrawLiftIfGiftScheduleChanged", () => {
  it("clears only primary lift when only primary schedule changed", () => {
    const merged = {
      leaderboards: {
        primary: { prizeDrawRankingFreezeLifted: true, enabled: true },
        secondary: { prizeDrawRankingFreezeLifted: true, enabled: true },
      },
    };
    const oldG = { templates: [{ key: "p", title: "P", drawAt: "2025-01-01T00:00:00.000Z", leaderboardScopes: ["primary"] }] };
    const newG = { templates: [{ key: "p", title: "P", drawAt: "2025-01-02T00:00:00.000Z", leaderboardScopes: ["primary"] }] };
    const out = clearPrizeDrawLiftIfGiftScheduleChanged(merged, oldG, newG, {});
    assert.equal((out.leaderboards as { primary: { prizeDrawRankingFreezeLifted?: boolean } }).primary.prizeDrawRankingFreezeLifted, undefined);
    assert.equal(
      (out.leaderboards as { secondary: { prizeDrawRankingFreezeLifted?: boolean } }).secondary.prizeDrawRankingFreezeLifted,
      true,
    );
  });

  it("preserves primary lift when preservePrimaryLift", () => {
    const merged = {
      leaderboards: {
        primary: { prizeDrawRankingFreezeLifted: true },
      },
    };
    const oldG = { templates: [{ key: "p", title: "P", drawAt: "2025-01-01T00:00:00.000Z" }] };
    const newG = { templates: [{ key: "p", title: "P", drawAt: "2025-01-02T00:00:00.000Z" }] };
    const out = clearPrizeDrawLiftIfGiftScheduleChanged(merged, oldG, newG, { preservePrimaryLift: true });
    assert.equal(
      (out.leaderboards as { primary: { prizeDrawRankingFreezeLifted?: boolean } }).primary.prizeDrawRankingFreezeLifted,
      true,
    );
  });
});

describe("effectiveLeaderboardXpFrozen", () => {
  const baseRow = (over: Partial<EdgeCampaignRow>): EdgeCampaignRow => ({
    public_id: "e1",
    edge_type: "character",
    title: "T",
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
    ...over,
  });

  it("freezes primary when drawAt passed and not lifted", () => {
    const now = new Date("2026-03-01T00:00:00.000Z");
    const row = baseRow({
      gifts_json: {
        templates: [{ key: "g", title: "G", drawAt: "2026-02-01T00:00:00.000Z", leaderboardScopes: ["primary"] }],
      },
    });
    assert.equal(effectiveLeaderboardXpFrozen(row, "primary", now), true);
    assert.equal(effectiveLeaderboardXpFrozen(row, "secondary", now), false);
  });

  it("respects prizeDrawRankingFreezeLifted", () => {
    const now = new Date("2026-03-01T00:00:00.000Z");
    const row = baseRow({
      gifts_json: {
        templates: [{ key: "g", title: "G", drawAt: "2026-02-01T00:00:00.000Z" }],
      },
      config_json: { leaderboards: { primary: { prizeDrawRankingFreezeLifted: true } } },
    });
    assert.equal(effectiveLeaderboardXpFrozen(row, "primary", now), false);
  });

  it("manual frozen_at blocks regardless of lift", () => {
    const now = new Date("2026-03-01T00:00:00.000Z");
    const row = baseRow({
      primary_leaderboard_frozen_at: new Date("2026-02-15T00:00:00.000Z"),
      config_json: { leaderboards: { primary: { prizeDrawRankingFreezeLifted: true } } },
    });
    assert.equal(effectiveLeaderboardXpFrozen(row, "primary", now), true);
  });
});
