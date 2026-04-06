import type { Request, Response } from "express";
import { getUserId } from "../../../auth/session";
import { parseNonNegativeIntQuery, parsePositiveIntQuery } from "../../../http/parse-positive-int-query";
import { PostsServiceError } from "../../../posts/posts-service-error";
import { getMyPushQuota } from "../../quota/get-my-push-quota";
import { listPushFeedForUser } from "../../feed/list-push-feed-for-user";
import { getPushSubscriptionStatus } from "../../subscriptions/get-push-subscription-status";
import { subscribeToAuthorPush } from "../../subscriptions/subscribe-to-author-push";
import { unsubscribeFromAuthorPush } from "../../subscriptions/unsubscribe-from-author-push";
import { getPushGlobalNotificationsSetting } from "../../subscriptions/get-push-global-notifications-setting";
import { updatePushGlobalNotificationsSetting } from "../../subscriptions/update-push-global-notifications-setting";
import { updateAuthorPushNotifications } from "../../subscriptions/update-push-subscription-notifications";
import { updateAuthorPushHidden } from "../../subscriptions/update-push-subscription-hidden";
import { hidePushFeedItemForUser } from "../../feed/hide-push-feed-item-for-user";

function parseAuthorId(req: Request): string {
  return String(req.params.authorId ?? "").trim();
}

function parseNotificationsEnabled(body: unknown): boolean | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as { notificationsEnabled?: unknown }).notificationsEnabled;
  if (typeof value !== "boolean") return null;
  return value;
}


export async function handleGetPushFeed(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req)!;
  const limit = parsePositiveIntQuery(req.query.limit, 20, 50);
  const offset = parseNonNegativeIntQuery(req.query.offset, 0, 5000);
  try {
    const list = await listPushFeedForUser({ userId, limit, offset });
    res.json(list);
  } catch (e) {
    console.error("[push-feed] list error:", e);
    res.status(500).json({ message: "Не удалось загрузить Push-ленту" });
  }
}


export async function handleGetPushQuota(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req)!;
  try {
    res.json(await getMyPushQuota(userId));
  } catch (e) {
    console.error("[push-feed] quota error:", e);
    res.status(500).json({ message: "Не удалось загрузить лимит Push" });
  }
}

export async function handleSubscribePush(req: Request, res: Response): Promise<void> {
  const subscriberId = getUserId(req)!;
  const authorId = parseAuthorId(req);
  if (!authorId) {
    res.status(400).json({ message: "authorId обязателен" });
    return;
  }
  try {
    await subscribeToAuthorPush({ subscriberId, authorId });
    res.json({ ok: true, subscribed: true });
  } catch (e) {
    if (e instanceof PostsServiceError) {
      res.status(e.status).json({ message: e.message });
      return;
    }
    console.error("[push-feed] subscribe error:", e);
    res.status(500).json({ message: "Не удалось подписаться на Push" });
  }
}

export async function handleUnsubscribePush(req: Request, res: Response): Promise<void> {
  const subscriberId = getUserId(req)!;
  const authorId = parseAuthorId(req);
  if (!authorId) {
    res.status(400).json({ message: "authorId обязателен" });
    return;
  }
  try {
    await unsubscribeFromAuthorPush({ subscriberId, authorId });
    res.json({ ok: true, subscribed: false });
  } catch (e) {
    console.error("[push-feed] unsubscribe error:", e);
    res.status(500).json({ message: "Не удалось отписаться от Push" });
  }
}

export async function handleGetPushSubscriptionStatus(req: Request, res: Response): Promise<void> {
  const subscriberId = getUserId(req)!;
  const authorId = parseAuthorId(req);
  if (!authorId) {
    res.status(400).json({ message: "authorId обязателен" });
    return;
  }
  try {
    res.json(await getPushSubscriptionStatus({ subscriberId, authorId }));
  } catch (e) {
    console.error("[push-feed] status error:", e);
    res.status(500).json({ message: "Не удалось проверить подписку Push" });
  }
}

export async function handleGetPushGlobalNotifications(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req)!;
  try {
    res.json(await getPushGlobalNotificationsSetting(userId));
  } catch (e) {
    console.error("[push-feed] global notifications get error:", e);
    res.status(500).json({ message: "Не удалось загрузить настройки Push-уведомлений" });
  }
}

export async function handlePatchPushGlobalNotifications(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req)!;
  const notificationsEnabled = parseNotificationsEnabled(req.body);
  if (notificationsEnabled == null) {
    res.status(400).json({ message: "notificationsEnabled должен быть boolean" });
    return;
  }
  try {
    await updatePushGlobalNotificationsSetting({ userId, notificationsEnabled });
    res.json({ ok: true, notificationsEnabled });
  } catch (e) {
    console.error("[push-feed] global notifications patch error:", e);
    res.status(500).json({ message: "Не удалось сохранить настройки Push-уведомлений" });
  }
}

export async function handlePatchAuthorPushNotifications(req: Request, res: Response): Promise<void> {
  const subscriberId = getUserId(req)!;
  const authorId = parseAuthorId(req);
  const notificationsEnabled = parseNotificationsEnabled(req.body);
  if (!authorId) {
    res.status(400).json({ message: "authorId обязателен" });
    return;
  }
  if (notificationsEnabled == null) {
    res.status(400).json({ message: "notificationsEnabled должен быть boolean" });
    return;
  }
  try {
    await updateAuthorPushNotifications({ subscriberId, authorId, notificationsEnabled });
    res.json({ ok: true, notificationsEnabled });
  } catch (e) {
    console.error("[push-feed] author notifications patch error:", e);
    res.status(500).json({ message: "Не удалось обновить уведомления этого автора" });
  }
}

export async function handlePatchAuthorPushHidden(req: Request, res: Response): Promise<void> {
  const subscriberId = getUserId(req)!;
  const authorId = parseAuthorId(req);
  const body = req.body as { hidden?: unknown } | undefined;
  if (!authorId) {
    res.status(400).json({ message: "authorId обязателен" });
    return;
  }
  if (typeof body?.hidden !== "boolean") {
    res.status(400).json({ message: "hidden должен быть boolean" });
    return;
  }
  try {
    await updateAuthorPushHidden({ subscriberId, authorId, hidden: body.hidden });
    res.json({ ok: true, hidden: body.hidden });
  } catch (e) {
    console.error("[push-feed] author hidden patch error:", e);
    res.status(500).json({ message: "Не удалось скрыть push автора" });
  }
}

export async function handleHidePushFeedItem(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req)!;
  const pushPostId = String(req.params.pushPostId ?? "").trim();
  if (!pushPostId) {
    res.status(400).json({ message: "pushPostId обязателен" });
    return;
  }
  try {
    await hidePushFeedItemForUser({ userId, pushPostId });
    res.json({ ok: true });
  } catch (e) {
    console.error("[push-feed] hide item error:", e);
    res.status(500).json({ message: "Не удалось скрыть push" });
  }
}

