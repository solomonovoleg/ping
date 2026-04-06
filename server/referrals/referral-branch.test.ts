import assert from "node:assert/strict";
import test from "node:test";
import {
  computeReferralBranchFromEdges,
  computeWeightedReferralScore,
  type ReferralEdge,
} from "./referral-branch";

test("computeReferralBranchFromEdges counts descendants by depth", () => {
  const edges: ReferralEdge[] = [
    { userId: "u1", invitedById: "root" },
    { userId: "u2", invitedById: "root" },
    { userId: "u3", invitedById: "u1" },
    { userId: "u4", invitedById: "u3" },
    { userId: "u5", invitedById: "u4" },
  ];
  const out = computeReferralBranchFromEdges("root", edges, 5);
  assert.equal(out.totalCount, 5);
  assert.deepEqual(out.byDepth, [
    { depth: 1, count: 2 },
    { depth: 2, count: 1 },
    { depth: 3, count: 1 },
    { depth: 4, count: 1 },
    { depth: 5, count: 0 },
  ]);
});

test("computeReferralBranchFromEdges avoids cycles", () => {
  const edges: ReferralEdge[] = [
    { userId: "a", invitedById: "root" },
    { userId: "b", invitedById: "a" },
    { userId: "root", invitedById: "b" },
  ];
  const out = computeReferralBranchFromEdges("root", edges, 5);
  assert.equal(out.totalCount, 2);
  assert.deepEqual(out.byDepth.slice(0, 2), [
    { depth: 1, count: 1 },
    { depth: 2, count: 1 },
  ]);
});

test("computeWeightedReferralScore applies per-depth weights", () => {
  const out = computeReferralBranchFromEdges(
    "root",
    [
      { userId: "u1", invitedById: "root" },
      { userId: "u2", invitedById: "u1" },
      { userId: "u3", invitedById: "u2" },
    ],
    5,
  );
  const score = computeWeightedReferralScore(out, [10, 10, 10, 10, 10]);
  assert.equal(score, 30);
});
