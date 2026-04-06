import type { Express, Request, Response } from "express";
import { writeAuditLog } from "../../../audit";
import { requireAdmin } from "../../../middleware";
import { adminDeletePost } from "../admin-delete-post/admin-delete-post";
import { adminDeletePostComment } from "../admin-delete-comment/admin-delete-comment";
import { adminDeleteChatMessage } from "../admin-delete-message/admin-delete-message";
import { adminDeleteStory } from "../admin-delete-story/admin-delete-story";
import { opsStrings } from "../../i18n.ru";

type ReqAdmin = Request & { adminUserId: string };

function paramId(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export function registerOpsContentRemoveAdminRoutes(app: Express): void {
  app.delete("/api/admin/ops/content/post/:postId", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req as ReqAdmin).adminUserId;
    const postId = paramId(req, "postId");
    try {
      const r = await adminDeletePost(postId);
      if (!r.ok) {
        res.status(404).json({ message: opsStrings.contentRemoveNotFound });
        return;
      }
      await writeAuditLog({
        adminId: adminUserId,
        action: "ops.content.post.delete",
        targetType: "post",
        targetId: postId,
        ip: req.ip,
      });
      res.status(204).end();
    } catch (e) {
      console.error("admin delete post", e);
      res.status(500).json({ message: opsStrings.contentRemoveError });
    }
  });

  app.delete("/api/admin/ops/content/story/:storyId", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req as ReqAdmin).adminUserId;
    const storyId = paramId(req, "storyId");
    try {
      const r = await adminDeleteStory(storyId);
      if (!r.ok) {
        res.status(404).json({ message: opsStrings.contentRemoveNotFound });
        return;
      }
      await writeAuditLog({
        adminId: adminUserId,
        action: "ops.content.story.delete",
        targetType: "story",
        targetId: storyId,
        ip: req.ip,
      });
      res.status(204).end();
    } catch (e) {
      console.error("admin delete story", e);
      res.status(500).json({ message: opsStrings.contentRemoveError });
    }
  });

  app.delete("/api/admin/ops/content/message", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req as ReqAdmin).adminUserId;
    const chatId = typeof req.body?.chatId === "string" ? req.body.chatId.trim() : "";
    const messageId = typeof req.body?.messageId === "string" ? req.body.messageId.trim() : "";
    try {
      const r = await adminDeleteChatMessage(chatId, messageId);
      if (!r.ok) {
        res.status(r.status).json({ message: opsStrings.contentRemoveNotFound });
        return;
      }
      await writeAuditLog({
        adminId: adminUserId,
        action: "ops.content.message.delete",
        targetType: "message",
        targetId: messageId,
        details: { chatId },
        ip: req.ip,
      });
      res.status(204).end();
    } catch (e) {
      console.error("admin delete message", e);
      res.status(500).json({ message: opsStrings.contentRemoveError });
    }
  });

  app.delete("/api/admin/ops/content/comment", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req as ReqAdmin).adminUserId;
    const postId = typeof req.body?.postId === "string" ? req.body.postId.trim() : "";
    const commentId = typeof req.body?.commentId === "string" ? req.body.commentId.trim() : "";
    try {
      const r = await adminDeletePostComment(postId, commentId);
      if (!r.ok) {
        res.status(r.status).json({ message: opsStrings.contentRemoveNotFound });
        return;
      }
      await writeAuditLog({
        adminId: adminUserId,
        action: "ops.content.comment.delete",
        targetType: "comment",
        targetId: commentId,
        details: { postId },
        ip: req.ip,
      });
      res.status(204).end();
    } catch (e) {
      console.error("admin delete comment", e);
      res.status(500).json({ message: opsStrings.contentRemoveError });
    }
  });
}
