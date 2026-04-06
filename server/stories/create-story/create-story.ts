import { extractMentions, MAX_POST_MENTIONS } from "@shared/schema/posts";
import { stories } from "@shared/schema";
import { getDb, ensureStoryCaptionNotificationSchema } from "../../db";
import { cleanupExpiredStories } from "../cleanup-expired-stories/cleanup-expired-stories";
import { StoriesServiceError } from "../stories-service-error/stories-service-error";
import { sendStoryMentionDirectMessages } from "../story-mention-dm";
import { resolveMediaUrlForClient } from "../../upload/s3-presign-media-urls";

const STORY_DEFAULT_EXPIRES_HOURS = 24;
const STORY_ALLOWED_EXPIRES_HOURS = [24, 46, 56] as const;
const STORY_CAPTION_MAX_LEN = 500;

function isAllowedStoryUrl(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export async function createStory(
  authorId: string,
  mediaUrl: string,
  thumbnailUrl: string | null,
  expiresInHours?: number | string,
  captionRaw?: string | null,
) {
  await ensureStoryCaptionNotificationSchema();
  await cleanupExpiredStories();
  const mediaUrlClean = mediaUrl.trim();
  const thumbnailUrlClean = typeof thumbnailUrl === "string" ? thumbnailUrl.trim() : null;
  if (!isAllowedStoryUrl(mediaUrlClean)) {
    throw new StoriesServiceError(400, "Некорректный mediaUrl");
  }
  if (thumbnailUrlClean && !isAllowedStoryUrl(thumbnailUrlClean)) {
    throw new StoriesServiceError(400, "Некорректный thumbnailUrl");
  }
  let captionClean: string | null = null;
  if (typeof captionRaw === "string" && captionRaw.trim()) {
    const t = captionRaw.trim();
    if (t.length > STORY_CAPTION_MAX_LEN) {
      throw new StoriesServiceError(400, `Подпись не длиннее ${STORY_CAPTION_MAX_LEN} символов`);
    }
    const mentionTokens = extractMentions(t);
    if (mentionTokens.length > MAX_POST_MENTIONS) {
      throw new StoriesServiceError(400, `Не больше ${MAX_POST_MENTIONS} упоминаний (@) в подписи к сторис`);
    }
    captionClean = t;
  }
  const requestedHours =
    typeof expiresInHours === "number"
      ? Math.trunc(expiresInHours)
      : typeof expiresInHours === "string"
        ? Number.parseInt(expiresInHours, 10)
        : STORY_DEFAULT_EXPIRES_HOURS;
  const validHours = STORY_ALLOWED_EXPIRES_HOURS.includes(requestedHours as 24 | 46 | 56)
    ? (requestedHours as 24 | 46 | 56)
    : STORY_DEFAULT_EXPIRES_HOURS;
  const expiresAt = new Date(Date.now() + validHours * 60 * 60 * 1000);
  const db = getDb();
  const [inserted] = await db
    .insert(stories)
    .values({
      authorId,
      mediaUrl: mediaUrlClean,
      thumbnailUrl: thumbnailUrlClean,
      expiresAt,
      ...(captionClean ? { caption: captionClean } : {}),
    })
    .returning();
  if (!inserted) throw new StoriesServiceError(500, "Не удалось создать сториз");
  if (captionClean) {
    sendStoryMentionDirectMessages(inserted.id, authorId, captionClean).catch((e) =>
      console.error("[stories] mention DMs:", e),
    );
  }
  const [mediaOut, thumbOut] = await Promise.all([
    resolveMediaUrlForClient(inserted.mediaUrl),
    resolveMediaUrlForClient(inserted.thumbnailUrl ?? null),
  ]);
  return {
    id: inserted.id,
    authorId: inserted.authorId,
    mediaUrl: mediaOut ?? inserted.mediaUrl,
    thumbnailUrl: thumbOut ?? inserted.thumbnailUrl ?? null,
    caption: inserted.caption ?? null,
    createdAt: inserted.createdAt?.toISOString?.() ?? inserted.createdAt,
    expiresAt: inserted.expiresAt?.toISOString?.() ?? inserted.expiresAt,
    expiresInHours: validHours,
  };
}
