import type { Request, Response } from "express";
import { parsePresetVerify } from "@shared/edge-task-preset-config";
import { getUserId } from "../auth/session";
import { notifyChatListUpdate } from "../calls/ws";
import { sendChatMessage } from "../messages/service";
import { generateReferralCode, normalizeReferralCodeInput } from "../referrals/code-generator";
import { storage } from "../storage";
import { fetchUpstreamCampaignConfig } from "./upstream-client";

const RATE_MS = 45_000;
const lastPackAt = new Map<string, number>();

const DEFAULT_DM_TEMPLATE = `Привет! Вот твои {{count}} персональных кода приглашения в PING по этой кампании (каждый код — для одного нового пользователя):

{{codes}}

Как пригласить: отправь другу один код — при регистрации в PING его вводят в поле приглашения.

Это личное сообщение от автора кампании — вкладка «Чаты» внизу экрана.`;

function rateKey(userId: string, edgeId: string, taskKey: string): string {
  return `${userId}\n${edgeId}\n${taskKey}`;
}

/** Как в EDGE `listTaskPresetsFromConfig`: плоский массив или вложенность по scope. */
function flattenTaskPresets(root: Record<string, unknown>): unknown[] {
  const raw = root.taskPresets;
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const scopes = ["game", "global", "commercial"] as const;
  const out: unknown[] = [];
  for (const s of scopes) {
    const arr = (raw as Record<string, unknown>)[s];
    if (Array.isArray(arr)) out.push(...arr);
  }
  return out;
}

/**
 * Генерирует N одноразовых реферальных кодов (не расходуют лимит пригласившего при регистрации)
 * и шлёт их участнику в ЛС от создателя кампании.
 */
export async function handlePostPingInvitePack(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const edgeId = String(req.query.edgeId ?? "").trim();
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  const taskKey = typeof (body as { taskKey?: unknown }).taskKey === "string"
    ? (body as { taskKey: string }).taskKey.trim()
    : "";

  if (!edgeId || !taskKey) {
    res.status(400).json({ error: "edgeId_and_taskKey_required" });
    return;
  }

  const rk = rateKey(userId, edgeId, taskKey);
  const prev = lastPackAt.get(rk) ?? 0;
  if (Date.now() - prev < RATE_MS) {
    res.status(429).json({ error: "rate_limited", retryAfterSec: Math.ceil((RATE_MS - (Date.now() - prev)) / 1000) });
    return;
  }

  const cfgUp = await fetchUpstreamCampaignConfig(edgeId);
  if (!cfgUp.ok || cfgUp.status < 200 || cfgUp.status >= 300) {
    res.status(503).json({ error: "edge_companion_unavailable" });
    return;
  }

  let root: Record<string, unknown>;
  try {
    root = JSON.parse(cfgUp.body) as Record<string, unknown>;
  } catch {
    res.status(503).json({ error: "edge_companion_invalid" });
    return;
  }

  const creatorId = typeof root.creatorPlatformUserId === "string" ? root.creatorPlatformUserId.trim() : "";
  if (!creatorId) {
    res.status(400).json({ error: "campaign_creator_unknown" });
    return;
  }

  const taskPresets = flattenTaskPresets(root);
  let verify: ReturnType<typeof parsePresetVerify> | null = null;
  for (const raw of taskPresets) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.key !== "string" || o.key.trim() !== taskKey) continue;
    verify = parsePresetVerify(o.verify);
    break;
  }

  if (!verify || verify.type !== "ping_invited_users") {
    res.status(400).json({ error: "task_not_ping_invite" });
    return;
  }

  const n = Math.min(50, Math.max(1, verify.minCount));
  const pingRaw = root.pingInviteDm;
  let template = DEFAULT_DM_TEMPLATE;
  let hours = 168;
  if (pingRaw && typeof pingRaw === "object" && !Array.isArray(pingRaw)) {
    const pi = pingRaw as Record<string, unknown>;
    const t = typeof pi.template === "string" ? pi.template.trim() : "";
    if (t) template = t;
    const h = pi.codeExpiresInHours;
    if (typeof h === "number" && Number.isFinite(h)) {
      hours = Math.min(720, Math.max(1, Math.floor(h)));
    }
  }

  const expiresAt = new Date();
  expiresAt.setTime(expiresAt.getTime() + hours * 3_600_000);

  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    let code = generateReferralCode("phrase");
    let attempts = 0;
    while (attempts < 8) {
      const clash = await storage.getReferralCodeByCode(normalizeReferralCodeInput(code));
      if (!clash) break;
      code = generateReferralCode("phrase");
      attempts += 1;
    }
    await storage.createReferralCode(creatorId, code, expiresAt, {
      maxUses: 1,
      bypassInviterLimit: true,
    });
    codes.push(code);
  }

  const codesBlock = codes.map((c, idx) => `${idx + 1}. ${c}`).join("\n");
  const appLink = (process.env.PING_INVITE_APP_URL ?? "").trim();
  const hadCodesPlaceholder = /\{\{\s*codes\s*\}\}/i.test(template);
  let text = template
    .replace(/\{\{\s*count\s*\}\}/gi, String(n))
    .replace(/\{\{\s*codes\s*\}\}/gi, codesBlock)
    .replace(/\{\{\s*appLink\s*\}\}/gi, appLink)
    .trim();

  if (!hadCodesPlaceholder) {
    const head =
      n === 1
        ? "Вот твой персональный код приглашения (один новый пользователь):"
        : `Вот твои ${n} персональных кода приглашения (каждый на одного нового пользователя):`;
    text = text.length > 0 ? `${text}\n\n${head}\n\n${codesBlock}` : `${head}\n\n${codesBlock}`;
  }

  try {
    const chat = await storage.getOrCreateDmChat(creatorId, userId);
    await sendChatMessage({
      userId: creatorId,
      chatId: chat.id,
      content: text,
      type: "text",
    });
    notifyChatListUpdate(userId);
    lastPackAt.set(rk, Date.now());
    res.json({
      ok: true,
      chatId: chat.id,
      codesCount: n,
      hint: "Откройте вкладку «Чаты» внизу экрана — сообщение от автора кампании.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send_failed";
    res.status(500).json({ error: "dm_failed", message: msg });
  }
}
