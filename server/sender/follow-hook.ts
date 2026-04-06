import { trySendSenderWelcomeDm } from "./service";

/** После новой подписки: опциональное приветствие в ЛС от автора (SENDER). */
export function scheduleSenderWelcomeDm(creatorUserId: string, followerUserId: string): void {
  if (!process.env.DATABASE_URL) return;
  void (async () => {
    try {
      await trySendSenderWelcomeDm(creatorUserId, followerUserId);
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[sender/follow-hook]", e);
      }
    }
  })();
}
