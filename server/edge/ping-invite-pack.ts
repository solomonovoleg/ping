import type { Request, Response } from "express";
import { parsePresetVerify } from "@shared/edge-task-preset-config";
import { getUserId } from "../auth/session";
import { notifyChatListUpdate } from "../calls/ws";
import { sendChatMessage } from "../messages/service";
import { generateReferralCode, normalizeReferralCodeInput } from "../referrals/code-generator";
import { storage } from "../storage";
import { fetchUpstreamCampaignConfig } from "./upstream-client";
import { verifyPresetOnPlatform } from "./verify-preset-platform";

const RATE_MS = 45_000;
const lastPackAt = new Map<string, number>();

const DEFAULT_DM_TEMPLATE = `Привет! Вот твои {{count}} персональных кода приглашения в PING по этой кампании (каждый код — для одного нового пользователя):

{{codes}}

Как пригласить: отправь другу один код — при регистрации в PING его вводят в поле приглашения.

Это личное сообщение от автора кампании — вкладка «Чаты» внизу экрана.`;

const DEFAULT_DM_TEMPLATE_MULTI_USE = `Привет! Общий код приглашения в PING по этой кампании (до {{maxUses}} регистраций на один и тот же код):

{{codes}}

Друзья вводят этот код при регистрации. Когда лимит исчерпан, запросите новый код в игре.

Это личное сообщение от автора кампании — вкладка «Чаты» внизу экрана.`;

const DEFAULT_DM_TEMPLATE_SINGLE = `Привет! Твой одноразовый код приглашения в PING по этой кампании:

{{codes}}

Отправь другу — при регистрации вводят код в поле приглашения. Новый код можно запросить в игре снова (с небольшой паузой).

Это личное сообщение от автора кампании — вкладка «Чаты» внизу экрана.`;

type PingInviteIssueMode = "batch_min_count" | "single_per_request" | "one_multi_use";

function parsePingInviteIssue(pi: Record<string, unknown>): {
  issueMode: PingInviteIssueMode;
  multiUseRegistrations: number;
} {
  const raw = pi.inviteIssueMode ?? pi.issueMode;
  const s = typeof raw === "string" ? raw.trim() : "";
  const issueMode: PingInviteIssueMode =
    s === "single_per_request" || s === "one_multi_use" ? s : "batch_min_count";
  const mu = pi.multiUseRegistrations ?? pi.multiUseMax;
  let multiUseRegistrations =
    typeof mu === "number" && Number.isFinite(mu) ? Math.floor(mu) : 50;
  multiUseRegistrations = Math.min(10_000, Math.max(2, multiUseRegistrations));
  return { issueMode, multiUseRegistrations };
}

function rateKey(userId: string, edgeId: string, taskKey: string): string {
  return `${userId}\n${edgeId}\n${taskKey}`;
}

/** Коды кампании привязаны к участнику: регистрация → `users.invited_by_id` = этот user. `maxUses` как в `referral_codes`. */
async function createOneDigitsInviteCode(
  inviterUserId: string,
  expiresAt: Date,
  maxUses: number,
): Promise<string> {
  let uses = Math.floor(maxUses);
  if (!Number.isFinite(uses) || uses < 1) uses = 1;
  if (uses > 10_000) uses = 10_000;
  for (let attempt = 0; attempt < 24; attempt++) {
    let code = generateReferralCode();
    let inner = 0;
    while (inner < 8) {
      const clash = await storage.getReferralCodeByCode(normalizeReferralCodeInput(code));
      if (!clash) break;
      code = generateReferralCode();
      inner += 1;
    }
    try {
      await storage.createReferralCode(inviterUserId, code, expiresAt, {
        maxUses: uses,
        bypassInviterLimit: true,
      });
      return code;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/unique|duplicate|23505/i.test(msg)) continue;
      throw e;
    }
  }
  throw new Error("Не удалось сгенерировать уникальный код приглашения");
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
 * Генерирует N одноразовых кодов (inviter = участник; `bypassInviterLimit` — не тратит лимит из Настроек)
 * и шлёт текст в ЛС от имени создателя кампании.
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

  try {
    const cfgUp = await fetchUpstreamCampaignConfig(edgeId, req.requestId);
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

    const gate = await verifyPresetOnPlatform({
      userId,
      edgeId,
      creatorPlatformUserId: creatorId,
      verify,
    });
    if (!gate.ok) {
      res.status(403).json({ error: "preset_verification_failed", reason: gate.reason });
      return;
    }

    const pingRaw = root.pingInviteDm;
    const piObj =
      pingRaw && typeof pingRaw === "object" && !Array.isArray(pingRaw)
        ? (pingRaw as Record<string, unknown>)
        : {};
    const { issueMode, multiUseRegistrations } = parsePingInviteIssue(piObj);

    let template =
      issueMode === "one_multi_use"
        ? DEFAULT_DM_TEMPLATE_MULTI_USE
        : issueMode === "single_per_request"
          ? DEFAULT_DM_TEMPLATE_SINGLE
          : DEFAULT_DM_TEMPLATE;
    let hours = 168;
    const tCustom = typeof piObj.template === "string" ? piObj.template.trim() : "";
    if (tCustom) template = tCustom;
    const h = piObj.codeExpiresInHours;
    if (typeof h === "number" && Number.isFinite(h)) {
      hours = Math.min(720, Math.max(1, Math.floor(h)));
    }

    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + hours * 3_600_000);

    /** Сколько строк в сообщении и какой maxUses у каждой создаваемой записи в БД. */
    let codeSpecs: { maxUses: number }[] = [];
    if (issueMode === "single_per_request") {
      codeSpecs = [{ maxUses: 1 }];
    } else if (issueMode === "one_multi_use") {
      codeSpecs = [{ maxUses: multiUseRegistrations }];
    } else {
      const n = Math.min(50, Math.max(1, verify.minCount));
      codeSpecs = Array.from({ length: n }, () => ({ maxUses: 1 }));
    }

    const codes: string[] = [];
    for (const spec of codeSpecs) {
      codes.push(await createOneDigitsInviteCode(userId, expiresAt, spec.maxUses));
    }

    const n = codes.length;
    const primaryMaxUses = codeSpecs[0]?.maxUses ?? 1;
    const codesBlock = codes.map((c, idx) => `${idx + 1}. ${c}`).join("\n");
    const appLink = (process.env.PING_INVITE_APP_URL ?? "").trim();
    const hadCodesPlaceholder = /\{\{\s*codes\s*\}\}/i.test(template);
    let text = template
      .replace(/\{\{\s*count\s*\}\}/gi, String(n))
      .replace(/\{\{\s*maxUses\s*\}\}/gi, String(primaryMaxUses))
      .replace(/\{\{\s*codes\s*\}\}/gi, codesBlock)
      .replace(/\{\{\s*appLink\s*\}\}/gi, appLink)
      .trim();

    if (!hadCodesPlaceholder) {
      let head: string;
      if (issueMode === "one_multi_use") {
        head =
          primaryMaxUses <= 1
            ? "Код приглашения:"
            : `Общий код (до ${primaryMaxUses} регистраций):`;
      } else if (n === 1) {
        head = "Вот твой персональный код приглашения (один новый пользователь):";
      } else {
        head = `Вот твои ${n} персональных кода приглашения (каждый на одного нового пользователя):`;
      }
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
        inviteIssueMode: issueMode,
        maxUses: primaryMaxUses,
        hint: "Откройте вкладку «Чаты» внизу экрана — сообщение от автора кампании.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "send_failed";
      res.status(500).json({ error: "dm_failed", message: msg });
    }
  } catch (e) {
    if (res.headersSent) return;
    console.error("[edge/ping-invite-pack]", e);
    const msg = e instanceof Error ? e.message : "invite_pack_failed";
    res.status(500).json({ error: "invite_pack_failed", message: msg });
  }
}
