import assert from "node:assert/strict";
import test from "node:test";
import type { Message } from "@shared/schema";
import {
  detectRapidTextBurst,
  rapidBurstIsNewCycleAfterPulse,
  TENSION_BURST_MAX_GAP_MS,
} from "./tension-pulse-detect";

function textMsg(senderId: string, t: number, id: string): Message {
  return {
    id,
    chatId: "c1",
    folderId: null,
    senderId,
    type: "text",
    content: "x",
    transcript: null,
    replyToId: null,
    forwardedFromMessageId: null,
    forwardedFromSenderId: null,
    forwardedFromSenderName: null,
    createdAt: new Date(t),
  } as Message;
}

test("detectRapidTextBurst: false if fewer than 6 text messages", () => {
  const u = "user-a";
  const msgs = [1000, 1500, 2000, 2500].map((t, i) => textMsg(u, t, `m${i}`));
  assert.equal(detectRapidTextBurst(msgs, u), false);
});

test("detectRapidTextBurst: true for 6 texts with gaps under max", () => {
  const u = "user-a";
  const base = 1_000_000;
  const msgs = [0, 400, 800, 1200, 1600, 2000].map((off, i) => textMsg(u, base + off, `m${i}`));
  assert.equal(detectRapidTextBurst(msgs, u), true);
});

test("detectRapidTextBurst: false if gap in newest-6 window exceeds max", () => {
  const u = "user-a";
  const base = 1_000_000;
  const gap = TENSION_BURST_MAX_GAP_MS + 500;
  const msgs = [0, 500, 1000, 1500, 2000, 2500, 2500 + gap].map((off, i) => textMsg(u, base + off, `m${i}`));
  assert.equal(detectRapidTextBurst(msgs, u), false);
});

test("detectRapidTextBurst: true when old history has huge gaps but last 6 are tight", () => {
  const u = "user-a";
  const base = 10_000_000;
  const chronological: Message[] = [];
  chronological.push(textMsg(u, base, "old0"));
  chronological.push(textMsg(u, base + 60_000, "old1"));
  chronological.push(textMsg(u, base + 120_000, "old2"));
  const tail = [0, 350, 700, 1050, 1400, 1750].map((off, i) => textMsg(u, base + 200_000 + off, `n${i}`));
  chronological.push(...tail);
  assert.equal(detectRapidTextBurst(chronological, u), true);
});

test("detectRapidTextBurst: stops at interleaved other sender", () => {
  const u = "user-a";
  const other = "b";
  const base = 1_000_000;
  const chronological = [
    textMsg(u, base, "m0"),
    textMsg(u, base + 500, "m1"),
    textMsg(u, base + 1000, "m2"),
    textMsg(u, base + 1500, "m3"),
    textMsg(other, base + 2000, "x"),
    textMsg(u, base + 2500, "m4"),
    textMsg(u, base + 3000, "m5"),
  ];
  assert.equal(detectRapidTextBurst(chronological, u), false);
});

test("rapidBurstIsNewCycleAfterPulse: false on 7th message if якорь — newest из предыдущей шестёрки", () => {
  const u = "user-a";
  const base = 2_000_000;
  const seven = [0, 400, 800, 1200, 1600, 2000, 2400].map((off, i) => textMsg(u, base + off, `m${i}`));
  /** Как на сервере после первого импульса: якорь = самое новое из шести (m4 в индексации 0..5 → индекс 5) */
  const anchorNewest = seven[5]!;
  assert.equal(detectRapidTextBurst(seven, u), true);
  assert.equal(rapidBurstIsNewCycleAfterPulse(seven, u, anchorNewest), false);
});

test("rapidBurstIsNewCycleAfterPulse: true only after 6 новых после якоря (12-е сообщение)", () => {
  const u = "user-a";
  const base = 3_000_000;
  const step = 400;
  const twelve = Array.from({ length: 12 }, (_, i) => textMsg(u, base + i * step, `x${i}`));
  const anchorAfterFirstBurst = twelve[5]!;
  assert.equal(rapidBurstIsNewCycleAfterPulse(twelve.slice(0, 7), u, anchorAfterFirstBurst), false);
  assert.equal(rapidBurstIsNewCycleAfterPulse(twelve, u, anchorAfterFirstBurst), true);
});

test("rapidBurstIsNewCycleAfterPulse: первый цикл без якоря — true при валидной шестёрке", () => {
  const u = "user-a";
  const base = 4_000_000;
  const six = [0, 400, 800, 1200, 1600, 2000].map((off, i) => textMsg(u, base + off, `a${i}`));
  assert.equal(rapidBurstIsNewCycleAfterPulse(six, u, null), true);
});
