import type { Express, NextFunction, Request, Response } from "express";
import { requireAuth } from "../../../auth/session";
import { PUSH_FEED_ENABLED } from "../../config/feature-flags";
import {
  handleGetPushFeed,
  handleGetPushGlobalNotifications,
  handleGetPushQuota,
  handleHidePushFeedItem,
  handlePatchAuthorPushNotifications,
  handlePatchAuthorPushHidden,
  handlePatchPushGlobalNotifications,
  handleGetPushSubscriptionStatus,
  handleSubscribePush,
  handleUnsubscribePush,
} from "./handlers";
import {
  handleCreatePushReply,
  handleGetPushOutbox,
  handleGetPushReplies,
  handleRecordPushPostView,
  handleRemovePushReaction,
  handleSetPushReaction,
} from "./handlers-engagement";

export function registerPushFeedRoutes(app: Express): void {
  app.use("/api/push", (_req: Request, res: Response, next: NextFunction) => {
    if (!PUSH_FEED_ENABLED) {
      res.status(404).json({ message: "Push временно отключен" });
      return;
    }
    next();
  });

  app.get("/api/push/feed", requireAuth, (req, res) => {
    void handleGetPushFeed(req, res);
  });
  app.get("/api/push/outbox", requireAuth, (req, res) => {
    void handleGetPushOutbox(req, res);
  });
  app.get("/api/push/quota", requireAuth, (req, res) => {
    void handleGetPushQuota(req, res);
  });
  app.get("/api/push/settings", requireAuth, (req, res) => {
    void handleGetPushGlobalNotifications(req, res);
  });
  app.patch("/api/push/settings", requireAuth, (req, res) => {
    void handlePatchPushGlobalNotifications(req, res);
  });
  app.post("/api/push/subscribe/:authorId", requireAuth, (req, res) => {
    void handleSubscribePush(req, res);
  });
  app.delete("/api/push/subscribe/:authorId", requireAuth, (req, res) => {
    void handleUnsubscribePush(req, res);
  });
  app.get("/api/push/subscription-status/:authorId", requireAuth, (req, res) => {
    void handleGetPushSubscriptionStatus(req, res);
  });
  app.patch("/api/push/subscribe/:authorId/settings", requireAuth, (req, res) => {
    void handlePatchAuthorPushNotifications(req, res);
  });
  app.patch("/api/push/subscribe/:authorId/hide", requireAuth, (req, res) => {
    void handlePatchAuthorPushHidden(req, res);
  });
  app.post("/api/push/feed/:pushPostId/hide", requireAuth, (req, res) => {
    void handleHidePushFeedItem(req, res);
  });
  app.post("/api/push/feed/:pushPostId/view", requireAuth, (req, res) => {
    void handleRecordPushPostView(req, res);
  });
  app.post("/api/push/feed/:pushPostId/reaction", requireAuth, (req, res) => {
    void handleSetPushReaction(req, res);
  });
  app.delete("/api/push/feed/:pushPostId/reaction", requireAuth, (req, res) => {
    void handleRemovePushReaction(req, res);
  });
  app.post("/api/push/feed/:pushPostId/replies", requireAuth, (req, res) => {
    void handleCreatePushReply(req, res);
  });
  app.get("/api/push/feed/:pushPostId/replies", requireAuth, (req, res) => {
    void handleGetPushReplies(req, res);
  });
}
