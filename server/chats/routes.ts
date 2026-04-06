import type { Express } from "express";
import { registerChatsReadRoutes } from "./register-chats-routes-read";
import { registerChatsWriteRoutes } from "./register-chats-routes-write";
import { registerChatInviteRoutes } from "./invite-routes";

export function registerChatsRoutes(app: Express): void {
  registerChatsReadRoutes(app);
  registerChatsWriteRoutes(app);
  registerChatInviteRoutes(app);
}
