import type { Request, Response } from "express";
import { getUserId } from "../../../auth/session";
import { parseNonNegativeIntQuery, parsePositiveIntQuery } from "../../../http/parse-positive-int-query";
import { listPushOutboxForUser } from "../../feed/list-push-outbox-for-user";
import { notifyPushReply } from "../../../notifications/create";
import {
  countPushReplies,
  insertPushReply,
  recordPushPostView,
  removePushReaction,
  selectPushPostOwner,
  selectPushReplies,
  upsertPushReaction,
} from "../../db/push-engagement.queries";

function parseReplyVisibility(body: unknown): "public" | "private" {
  const value = body && typeof body === "object" ? (body as { visibility?: unknown }).visibility : null;
  return value === "private" ? "private" : "public";
}

function parseRepliesVisibilityFilter(query: Request["query"]): boolean {
  const raw = typeof query.visibility === "string" ? query.visibility.trim().toLowerCase() : "";
  return raw === "public";
}

export async function handleGetPushOutbox(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req)!;
  const limit = parsePositiveIntQuery(req.query.limit, 20, 50);
  const offset = parseNonNegativeIntQuery(req.query.offset, 0, 5000);
  try {
    const list = await listPushOutboxForUser({ userId, limit, offset });
    res.json(list);
  } catch (e) {
    console.error("[push-feed] outbox list error:", e);
    res.status(500).json({ message: "Не удалось загрузить исходящие Push" });
  }
}

export async function handleSetPushReaction(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req)!;
  const pushPostId = String(req.params.pushPostId ?? "").trim();
  const emoji =
    req.body && typeof req.body === "object" && typeof (req.body as { emoji?: unknown }).emoji === "string"
      ? String((req.body as { emoji: string }).emoji)
      : "❤️";
  if (!pushPostId) {
    res.status(400).json({ message: "pushPostId обязателен" });
    return;
  }
  try {
    await upsertPushReaction(pushPostId, userId, emoji);
    res.json({ ok: true });
  } catch (e) {
    console.error("[push-feed] set reaction error:", e);
    res.status(500).json({ message: "Не удалось поставить реакцию на Push" });
  }
}

export async function handleRemovePushReaction(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req)!;
  const pushPostId = String(req.params.pushPostId ?? "").trim();
  if (!pushPostId) {
    res.status(400).json({ message: "pushPostId обязателен" });
    return;
  }
  try {
    await removePushReaction(pushPostId, userId);
    res.json({ ok: true });
  } catch (e) {
    console.error("[push-feed] remove reaction error:", e);
    res.status(500).json({ message: "Не удалось убрать реакцию на Push" });
  }
}

export async function handleCreatePushReply(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req)!;
  const pushPostId = String(req.params.pushPostId ?? "").trim();
  const text =
    req.body && typeof req.body === "object" && typeof (req.body as { text?: unknown }).text === "string"
      ? String((req.body as { text: string }).text).trim()
      : "";
  if (!pushPostId) {
    res.status(400).json({ message: "pushPostId обязателен" });
    return;
  }
  if (!text) {
    res.status(400).json({ message: "Текст ответа обязателен" });
    return;
  }
  try {
    const owner = await selectPushPostOwner(pushPostId);
    if (!owner) {
      res.status(404).json({ message: "Push не найден" });
      return;
    }
    const inserted = await insertPushReply({
      pushPostId,
      postId: owner.postId,
      authorId: userId,
      pushAuthorId: owner.authorId,
      visibility: parseReplyVisibility(req.body),
      text,
    });
    if (inserted) {
      notifyPushReply({
        pushAuthorId: owner.authorId,
        actorId: userId,
        postId: owner.postId,
        excerpt: text,
      }).catch((err) => console.error("[push-feed] notify push_reply:", err));
    }
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error("[push-feed] create reply error:", e);
    res.status(500).json({ message: "Не удалось отправить ответ на Push" });
  }
}

export async function handleGetPushReplies(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req)!;
  const pushPostId = String(req.params.pushPostId ?? "").trim();
  const limit = parsePositiveIntQuery(req.query.limit, 25, 50);
  const offset = parseNonNegativeIntQuery(req.query.offset, 0, 5000);
  const publicOnly = parseRepliesVisibilityFilter(req.query);
  if (!pushPostId) {
    res.status(400).json({ message: "pushPostId обязателен" });
    return;
  }
  try {
    const [rows, total] = await Promise.all([
      selectPushReplies({ pushPostId, viewerId: userId, limit, offset, publicOnly }),
      countPushReplies({ pushPostId, viewerId: userId, publicOnly }),
    ]);
    const items = rows.map((row) => ({
      id: row.id,
      text: row.text,
      visibility: row.visibility === "private" ? "private" : "public",
      createdAt: row.createdAt?.toISOString?.() ?? null,
      author: {
        id: row.authorId,
        publicId: row.authorPublicId ?? null,
        displayName: [row.authorDisplayName, row.authorSurname].filter(Boolean).join(" ").trim() || "Пользователь",
        avatarUrl: row.authorAvatarUrl ?? null,
      },
    }));
    res.json({ items, total, limit, offset });
  } catch (e) {
    console.error("[push-feed] list replies error:", e);
    res.status(500).json({ message: "Не удалось загрузить ответы на Push" });
  }
}

export async function handleRecordPushPostView(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req)!;
  const pushPostId = String(req.params.pushPostId ?? "").trim();
  if (!pushPostId) {
    res.status(400).json({ message: "pushPostId обязателен" });
    return;
  }
  try {
    const result = await recordPushPostView({ pushPostId, viewerUserId: userId });
    if (result === "not_found") {
      res.status(404).json({ message: "Push не найден" });
      return;
    }
    if (result === "forbidden") {
      res.status(403).json({ message: "Нет доступа" });
      return;
    }
    res.status(204).end();
  } catch (e) {
    console.error("[push-feed] record view error:", e);
    res.status(500).json({ message: "Не удалось сохранить просмотр" });
  }
}
