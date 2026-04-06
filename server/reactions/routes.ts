import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { postReactions, posts } from "@shared/schema";
import { requireAuth, getUserId } from "../auth/session";
import { notifyReaction } from "../notifications/create";
import { resolveCanonicalPostId } from "../posts/resolve-post-ref";
import { storage } from "../storage";

const ALLOWED_EMOJIS = ["👍", "❤️", "🔥", "👏", "😂", "🤔"];

export function registerReactionsRoutes(app: Express): void {
  /** Поставить или изменить реакцию на пост (только авторизованный пользователь) */
  app.post("/api/posts/:postId/reactions", requireAuth, async (req: Request, res: Response) => {
    const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
    const userId = getUserId(req)!;
    const emoji = typeof req.body?.emoji === "string" ? req.body.emoji.trim() : "";
    if (!postId || !ALLOWED_EMOJIS.includes(emoji)) {
      res.status(400).json({ message: "Укажите emoji: один из " + ALLOWED_EMOJIS.join(", ") });
      return;
    }
    try {
      const canonical = await resolveCanonicalPostId(postId);
      if (!canonical) {
        res.status(404).json({ message: "Пост не найден" });
        return;
      }
      const db = getDb();
      const [postRow] = await db
        .select({ authorId: posts.authorId })
        .from(posts)
        .where(eq(posts.id, canonical))
        .limit(1);
      if (!postRow) {
        res.status(404).json({ message: "Пост не найден" });
        return;
      }
      if (postRow.authorId !== userId) {
        const bf = await storage.getBlockFlags(postRow.authorId, userId);
        if (bf?.restrictSocial) {
          res.status(403).json({ message: "Пользователь отключил для вас комментарии и реакции" });
          return;
        }
      }
      const [existing] = await db
        .select({ emoji: postReactions.emoji })
        .from(postReactions)
        .where(and(eq(postReactions.postId, canonical), eq(postReactions.userId, userId)))
        .limit(1);
      if (existing) {
        if (existing.emoji !== emoji) {
          await db
            .update(postReactions)
            .set({ emoji })
            .where(and(eq(postReactions.postId, canonical), eq(postReactions.userId, userId)));
        }
      } else {
        await db.insert(postReactions).values({ postId: canonical, userId, emoji });
        if (postRow.authorId !== userId) {
          void import("../edge-money-profile-likes/handle-profile-like-for-edge-money")
            .then((m) => m.handleProfileLikeForEdgeMoney({ recipientUserId: postRow.authorId }))
            .catch((e) => console.error("[edge-money-profile-likes]", e));
        }
      }
      notifyReaction(canonical, userId, emoji).catch((e) => console.error("[reactions] notify:", e));
      const { scheduleEdgeTaskAfterPostAction } = await import("../posts/edge-task-hook");
      scheduleEdgeTaskAfterPostAction(userId, canonical, "react_post");
      res.status(204).end();
    } catch (e) {
      console.error("Post reaction error:", e);
      res.status(500).json({ message: "Не удалось поставить реакцию" });
    }
  });

  /** Убрать реакцию с поста */
  app.delete("/api/posts/:postId/reactions", requireAuth, async (req: Request, res: Response) => {
    const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
    const userId = getUserId(req)!;
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    try {
      const canonical = await resolveCanonicalPostId(postId);
      if (!canonical) {
        res.status(404).json({ message: "Пост не найден" });
        return;
      }
      const db = getDb();
      await db
        .delete(postReactions)
        .where(and(eq(postReactions.postId, canonical), eq(postReactions.userId, userId)));
      res.status(204).end();
    } catch (e) {
      console.error("Delete reaction error:", e);
      res.status(500).json({ message: "Не удалось убрать реакцию" });
    }
  });
}
