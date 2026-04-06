import { MAX_PUSH_POSTS_PER_DAY_DEFAULT } from "../constants/push-limits";
import {
  countPushDeviceNotifyRecipientsByAuthor,
  countPushFeedSubscribersByAuthor,
} from "../db/push-subscriptions.queries";
import { countAuthorPushPostsInDailyWindow } from "../db/push-posts.queries";
import type { PushQuota } from "../types/contracts";

export async function getMyPushQuota(userId: string): Promise<PushQuota> {
  const used = await countAuthorPushPostsInDailyWindow(userId);
  const [subscribersInFeed, notifyRecipients] = await Promise.all([
    countPushFeedSubscribersByAuthor(userId),
    countPushDeviceNotifyRecipientsByAuthor(userId),
  ]);
  return {
    maxPerDay: MAX_PUSH_POSTS_PER_DAY_DEFAULT,
    used,
    remaining: Math.max(0, MAX_PUSH_POSTS_PER_DAY_DEFAULT - used),
    subscribersInFeed,
    notifyRecipients,
  };
}
