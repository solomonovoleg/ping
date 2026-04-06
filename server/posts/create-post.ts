import { getDb } from "../db";
import { notifyMentionsPost } from "../notifications/mentions";
import { storage } from "../storage";
import { extractHashtags, extractMentions, MAX_POST_MENTIONS, posts } from "@shared/schema";
import type { PostMediaLayout } from "@shared/post-media-layout";
import { resolveEdgeDisplayAudienceFromUpstream } from "./edge-display-audience";
import { normalizePostMediaPublic } from "./normalize-post-media";
import { parsePostEdgeId } from "./post-edge-id";
import { PostsServiceError } from "./posts-service-error";
import { mintUniquePostLinkCode } from "./post-link-code";
import { schedulePostContentInterestsClassification } from "./classify-post-content-interests";
import {
  assertPushDailyLimit,
  fanoutPushPost,
  insertPushPost,
  parsePushTtl,
  PUSH_FEED_ENABLED,
} from "../push-feed/service";
import type { PushTtlValue } from "@shared/schema/push-feed";

export type CreatePostInput = {
  userId: string;
  text: string;
  imageUrl: string | null;
  mediaUrls: string[] | null;
  mediaLayout: PostMediaLayout | null;
  isDraft: boolean;
  visibility: "public" | "followers";
  edgeId?: string | null;
  /** false — не показывать превью по внешней видеоссылке в тексте */
  linkEmbedEnabled?: boolean;
  sendToPush?: boolean;
  pushTtl?: PushTtlValue;
  /** Только вместе с sendToPush: не показывать пост на стене профиля и в глобальной ленте */
  showOnAuthorWall?: boolean;
};

export async function createPost(input: CreatePostInput) {
  const { userId, text, imageUrl, mediaUrls, mediaLayout, isDraft, visibility } = input;
  let edgeIdToStore: string | null = null;
  if (input.edgeId !== undefined && input.edgeId !== null) {
    const trimmed = typeof input.edgeId === "string" ? input.edgeId.trim() : "";
    if (trimmed) {
      const parsed = parsePostEdgeId(input.edgeId);
      if (!parsed) {
        throw new PostsServiceError(400, "Некорректный edgeId");
      }
      edgeIdToStore = parsed;
    }
  }
  const mentionTokens = extractMentions(text);
  if (mentionTokens.length > MAX_POST_MENTIONS) {
    throw new PostsServiceError(400, `Не больше ${MAX_POST_MENTIONS} упоминаний (@) в посте`);
  }
  let edgeAudienceForInsert: string | null = null;
  if (edgeIdToStore) {
    edgeAudienceForInsert = await resolveEdgeDisplayAudienceFromUpstream(edgeIdToStore);
  }
  const firstUrl = mediaUrls?.length ? mediaUrls[0] : imageUrl;
  const hashtags = extractHashtags(text);
  const linkEmbedEnabled = input.linkEmbedEnabled !== false;
  const sendToPush = input.sendToPush === true && !isDraft;
  const pushTtl = parsePushTtl(input.pushTtl);
  const showOnAuthorWall =
    sendToPush && input.showOnAuthorWall === false ? false : true;
  if (sendToPush && !PUSH_FEED_ENABLED) {
    throw new PostsServiceError(503, "Push временно отключен");
  }
  if (sendToPush) {
    await assertPushDailyLimit(userId);
  }
  const db = getDb();
  const linkCode = await mintUniquePostLinkCode();
  const [row] = await db
    .insert(posts)
    .values({
      linkCode,
      authorId: userId,
      text,
      imageUrl: firstUrl ?? null,
      mediaUrls: mediaUrls ?? (imageUrl ? [imageUrl] : null),
      mediaLayout,
      hashtags: hashtags.length > 0 ? hashtags : null,
      isDraft: !!isDraft,
      visibility,
      edgeId: edgeIdToStore,
      linkEmbedEnabled,
      showOnAuthorWall,
      ...(edgeIdToStore && edgeAudienceForInsert ? { edgeDisplayAudience: edgeAudienceForInsert } : {}),
    })
    .returning();
  if (!row) {
    throw new PostsServiceError(500, "Не удалось создать пост");
  }
  if (!isDraft) {
    notifyMentionsPost(row.id, userId, text, storage).catch((e) => console.error("[posts] notify mentions:", e));
    void import("../edge-money-post-created/handle-post-created-for-edge-money")
      .then((m) => m.handlePostCreatedForEdgeMoney({ userId }))
      .catch((e) => console.error("[edge-money-post-created]", e));
    schedulePostContentInterestsClassification(row.id);
    if (sendToPush) {
      await insertPushPost({ postId: row.id, authorId: userId, ttl: pushTtl });
      void fanoutPushPost({
        postId: row.id,
        postLinkCode: row.linkCode ?? null,
        authorId: userId,
        excerpt: row.text.slice(0, 140),
      }).catch((e) => console.error("[push-feed] fanout:", e));
    }
  }
  const { imageUrl: outImg, mediaUrls: urls } = normalizePostMediaPublic(row.imageUrl, row.mediaUrls);
  return {
    id: row.id,
    linkCode: row.linkCode,
    authorId: row.authorId,
    text: row.text,
    imageUrl: outImg,
    mediaUrls: urls,
    mediaLayout: (row.mediaLayout as PostMediaLayout | null) ?? null,
    isDraft: row.isDraft ?? false,
    visibility: row.visibility ?? "public",
    edgeId: row.edgeId ?? null,
    linkEmbedEnabled: row.linkEmbedEnabled !== false,
    sendToPush,
    pushTtl: sendToPush ? pushTtl : null,
    showOnAuthorWall: row.showOnAuthorWall !== false,
    createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}
