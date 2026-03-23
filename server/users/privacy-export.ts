import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { storage } from "../storage";
import { posts, savedPosts } from "@shared/schema";
import type { User } from "@shared/schema";
import { resolvePlainPhoneForUserRow } from "../auth/phone-at-rest";

const LIST_PAGE = 400;
const SAVED_PAGE = 200;
const POSTS_CAP = 4000;

function publicUserSnapshot(u: User) {
  const {
    password: _p,
    fcmToken: _f,
    phoneCipher: _c,
    phoneLookupHash: _h,
    phone: _storedPhone,
    ...rest
  } = u as User & { password?: string; fcmToken?: string | null };
  const phone = resolvePlainPhoneForUserRow(u);
  return { ...rest, phone };
}

export async function buildUserDataExport(userId: string): Promise<Record<string, unknown> | null> {
  const user = await storage.getUser(userId);
  if (!user) return null;

  const followers: Awaited<ReturnType<typeof storage.getFollowersList>> = [];
  for (let offset = 0; ; offset += LIST_PAGE) {
    const batch = await storage.getFollowersList(userId, LIST_PAGE, offset);
    followers.push(...batch);
    if (batch.length < LIST_PAGE) break;
  }

  const following: Awaited<ReturnType<typeof storage.getFollowingList>> = [];
  for (let offset = 0; ; offset += LIST_PAGE) {
    const batch = await storage.getFollowingList(userId, LIST_PAGE, offset);
    following.push(...batch);
    if (batch.length < LIST_PAGE) break;
  }

  const chatsRaw = await storage.getChatsForUser(userId);
  const chats = await Promise.all(
    chatsRaw.map(async (c) => ({
      id: c.id,
      type: c.type,
      name: c.name ?? null,
      avatarUrl: c.avatarUrl ?? null,
      createdAt: c.createdAt,
      memberUserIds: await storage.getChatMemberIds(c.id),
    })),
  );

  const savedMessages = [];
  for (let offset = 0; ; offset += SAVED_PAGE) {
    const batch = await storage.listSavedMessages(userId, SAVED_PAGE, offset);
    savedMessages.push(...batch);
    if (batch.length < SAVED_PAGE) break;
  }

  const contacts = await storage.listContactUserIds(userId);
  const invitedUsers = await storage.listInvitedUsers(userId);

  let authoredPosts: {
    id: string;
    text: string;
    imageUrl: string | null;
    mediaUrls: string[] | null;
    isDraft: boolean;
    visibility: string;
    createdAt: Date;
  }[] = [];
  let savedPostIds: string[] = [];
  let feedPostsIncluded = false;

  try {
    const db = getDb();
    feedPostsIncluded = true;
    authoredPosts = await db
      .select({
        id: posts.id,
        text: posts.text,
        imageUrl: posts.imageUrl,
        mediaUrls: posts.mediaUrls,
        isDraft: posts.isDraft,
        visibility: posts.visibility,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(eq(posts.authorId, userId))
      .orderBy(desc(posts.createdAt))
      .limit(POSTS_CAP);

    const savedRows = await db.select({ postId: savedPosts.postId }).from(savedPosts).where(eq(savedPosts.userId, userId));
    savedPostIds = savedRows.map((r) => r.postId);
  } catch {
    /* нет БД или сбой — остальной снимок всё равно отдаём */
  }

  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    profile: publicUserSnapshot(user),
    followers,
    following,
    chats,
    contacts,
    invitedUsers,
    savedMessages,
    authoredPosts,
    savedPostIds,
    meta: {
      feedPostsAndSavedIdsFromDatabase: feedPostsIncluded,
      authoredPostsTruncatedTo: POSTS_CAP,
    },
    note: feedPostsIncluded
      ? undefined
      : "Посты ленты и список сохранённых постов не включены: сервер без подключения к PostgreSQL.",
  };
}
