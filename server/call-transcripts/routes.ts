import type { Express, Request, Response } from "express";
import { getUserId, requireAuth } from "../auth/session";
import { getCallHistoryDetail, getCallHistoryList, resolveCallSuggestion } from "./service";

function getParam(req: Request, key: string): string {
  const raw = req.params[key];
  return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
}

export function registerCallTranscriptRoutes(app: Express): void {
  app.get("/api/call-history", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const list = await getCallHistoryList(userId);
    res.json(
      list.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        endedAt: item.endedAt?.toISOString() ?? null,
      })),
    );
  });

  app.get("/api/call-history/:callId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const callId = getParam(req, "callId");
    const data = await getCallHistoryDetail(userId, callId);
    res.json({
      segments: data.segments.map((segment) => ({
        ...segment,
        createdAt: segment.createdAt.toISOString(),
        updatedAt: segment.updatedAt.toISOString(),
      })),
      suggestions: data.suggestions.map((suggestion) => ({
        ...suggestion,
        createdAt: suggestion.createdAt.toISOString(),
        resolvedAt: suggestion.resolvedAt?.toISOString() ?? null,
      })),
    });
  });

  app.post("/api/call-history/:callId/suggestions/:suggestionId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const callId = getParam(req, "callId");
    const suggestionId = getParam(req, "suggestionId");
    const status = req.body?.status === "accepted" ? "accepted" : "dismissed";
    await resolveCallSuggestion(userId, callId, suggestionId, status);
    res.json({ ok: true });
  });
}
