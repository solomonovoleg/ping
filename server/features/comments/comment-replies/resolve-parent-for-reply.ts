import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { postComments, users } from "@shared/schema";
import type { getDb } from "../../../db";
import { storage } from "../../../storage";

type Db = ReturnType<typeof getDb>;

export type ResolvedParent =
  | {
      ok: true;
      parentCommentAuthorId: string;
      parentAuthorNameForResponse: string | null;
      parentTextForResponse: string | null;
      resolvedParentId: string;
    }
  | { ok: false; status: number; message: string };

export async function resolveParentForReply(
  db: Db,
  postId: string,
  parentCommentIdRaw: unknown,
  actingUserId: string,
): Promise<ResolvedParent> {
  const pid = String(parentCommentIdRaw).trim();
  if (!pid) {
    return { ok: false, status: 400, message: "Комментарий для ответа не найден" };
  }
  const parentAuthor = alias(users, "parent_comment_author");
  const [parentRow] = await db
    .select({
      userId: postComments.userId,
      postId: postComments.postId,
      text: postComments.text,
      pdn: parentAuthor.displayName,
      psn: parentAuthor.surname,
    })
    .from(postComments)
    .leftJoin(parentAuthor, eq(postComments.userId, parentAuthor.id))
    .where(and(eq(postComments.id, pid), eq(postComments.postId, postId)))
    .limit(1);

  const parentAuthorUserId = parentRow?.userId;
  if (!parentAuthorUserId) {
    return { ok: false, status: 400, message: "Комментарий для ответа не найден" };
  }
  if (parentAuthorUserId !== actingUserId) {
    const pbf = await storage.getBlockFlags(parentAuthorUserId, actingUserId);
    if (pbf?.restrictSocial) {
      return {
        ok: false,
        status: 403,
        message: "Пользователь отключил для вас комментарии и реакции",
      };
    }
  }
  return {
    ok: true,
    parentCommentAuthorId: parentAuthorUserId,
    parentAuthorNameForResponse: [parentRow.pdn, parentRow.psn].filter(Boolean).join(" ") || "Пользователь",
    parentTextForResponse: typeof parentRow.text === "string" ? parentRow.text.slice(0, 180) : null,
    resolvedParentId: pid,
  };
}
