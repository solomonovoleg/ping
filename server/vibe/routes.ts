import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { getVibeThemeTokens } from "./theme-profiles";
import type { VibeThemeCode } from "@shared/chat-vibe-types";
import { VIBE_THEMES } from "@shared/chat-vibe-types";

function getUserId(req: Request): string | null {
  return (req.session as any)?.userId ?? null;
}

function requireAuth(req: Request, res: Response): string | null {
  const uid = getUserId(req);
  if (!uid) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return uid;
}

export function registerVibeRoutes(app: Express): void {
  app.get("/api/chats/:chatId/vibe", async (req, res) => {
    try {
      const userId = requireAuth(req, res);
      if (!userId) return;

      const chatId = req.params.chatId;
      const chat = await storage.getChatById(chatId);
      if (!chat || chat.type !== "dm") {
        return res.json({ active: false });
      }

      const memberIds = await storage.getChatMemberIds(chatId);
      if (!memberIds.includes(userId)) {
        return res.status(403).json({ error: "Нет доступа к чату" });
      }

      const otherId = memberIds.find((id) => id !== userId);
      if (!otherId) return res.json({ active: false });

      const [me, other] = await Promise.all([
        storage.getUser(userId),
        storage.getUser(otherId),
      ]);
      if (!me || !other) return res.json({ active: false });

      const myEnabled = (me as any).vibeEnabled === true;
      const otherEnabled = (other as any).vibeEnabled === true;
      const otherShares = (other as any).vibeShareWithPartner === true;
      const myShares = (me as any).vibeShareWithPartner === true;

      const iSeeVibe = myEnabled || (otherEnabled && otherShares);

      if (!iSeeVibe) {
        return res.json({ active: false });
      }

      const state = await storage.getVibeState(chatId);
      if (!state) {
        return res.json({
          active: true,
          theme: "casual",
          confidence: 0.3,
          tokens: getVibeThemeTokens("casual"),
          visualIntensity: 0,
        });
      }

      const theme = state.theme as VibeThemeCode;
      return res.json({
        active: true,
        theme,
        confidence: Number(state.confidence),
        tokens: getVibeThemeTokens(theme),
        visualIntensity: Number(state.confidence) >= 0.7 ? 2 : Number(state.confidence) >= 0.5 ? 1 : 0,
        axes: {
          warmth: state.warmth,
          tension: state.tension,
          playfulness: state.playfulness,
          intimacy: state.intimacy,
          formality: state.formality,
          energy: state.energy,
        },
      });
    } catch (err) {
      console.error("[vibe] GET vibe error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.put("/api/chats/:chatId/vibe/override", async (req, res) => {
    try {
      const userId = requireAuth(req, res);
      if (!userId) return;

      const chatId = req.params.chatId;
      const { theme } = req.body ?? {};
      if (!theme || !VIBE_THEMES.includes(theme)) {
        return res.status(400).json({ error: "Invalid theme" });
      }

      const memberIds = await storage.getChatMemberIds(chatId);
      if (!memberIds.includes(userId)) {
        return res.status(403).json({ error: "Нет доступа к чату" });
      }

      const existing = await storage.getVibeState(chatId);
      const state = await storage.upsertVibeState(chatId, {
        theme: theme as VibeThemeCode,
        confidence: 1.0,
        axes: existing
          ? { warmth: existing.warmth, tension: existing.tension, playfulness: existing.playfulness, intimacy: existing.intimacy, formality: existing.formality, energy: existing.energy }
          : { warmth: 50, tension: 10, playfulness: 30, intimacy: 20, formality: 30, energy: 40 },
        messageCounter: existing?.messageCounter ?? 0,
        themeVersion: (existing?.themeVersion ?? 1) + 1,
      });

      if (existing) {
        await storage.createVibeHistoryEntry({
          chatId,
          oldTheme: existing.theme,
          newTheme: theme,
          oldConfidence: Number(existing.confidence),
          newConfidence: 1.0,
          triggerType: "manual",
        });
      }

      const { notifyVibeUpdate } = await import("../realtime/chat");
      notifyVibeUpdate(chatId, {
        type: "chat-vibe-update",
        chatId,
        theme,
        confidence: 1.0,
        tokens: getVibeThemeTokens(theme as VibeThemeCode),
        visualIntensity: 2,
      });

      return res.json({ ok: true, theme, themeVersion: state.themeVersion });
    } catch (err) {
      console.error("[vibe] PUT override error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/users/me/vibe-settings", async (req, res) => {
    try {
      const userId = requireAuth(req, res);
      if (!userId) return;

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json({
        vibeEnabled: (user as any).vibeEnabled ?? false,
        vibeShareWithPartner: (user as any).vibeShareWithPartner ?? false,
      });
    } catch (err) {
      console.error("[vibe] GET settings error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.patch("/api/users/me/vibe-settings", async (req, res) => {
    try {
      const userId = requireAuth(req, res);
      if (!userId) return;

      const { vibeEnabled, vibeShareWithPartner } = req.body ?? {};
      const update: Record<string, boolean> = {};
      if (typeof vibeEnabled === "boolean") update.vibeEnabled = vibeEnabled;
      if (typeof vibeShareWithPartner === "boolean") update.vibeShareWithPartner = vibeShareWithPartner;

      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const updated = await storage.updateUserProfile(userId, update as any);
      if (!updated) return res.status(404).json({ error: "User not found" });

      return res.json({
        vibeEnabled: (updated as any).vibeEnabled ?? false,
        vibeShareWithPartner: (updated as any).vibeShareWithPartner ?? false,
      });
    } catch (err) {
      console.error("[vibe] PATCH settings error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  });
}
