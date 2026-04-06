import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { partnerAuth } from "../middleware/partner-auth.js";
import { requireSession } from "../middleware/session-auth.js";
import { userRateLimit } from "../middleware/rate-limit.js";
import { signSessionToken } from "../security/token.js";
import { store } from "../store/in-memory-store.js";
import { emitHubEvent } from "../realtime/hub-events.js";

const presenceSchema = z.object({
  state: z.enum(["online", "offline"]),
});

export const realtimeRoutes = Router();

realtimeRoutes.get("/realtime/token", partnerAuth, requireSession(["chat.read"]), userRateLimit, (req, res) => {
  const payload = req.sessionAuth!;
  const token = signSessionToken(payload, config.jwtSecret, 120);
  res.json({ ok: true, token, expiresIn: 120 });
});

realtimeRoutes.post("/presence", partnerAuth, requireSession(["presence.write"]), userRateLimit, (req, res) => {
  const parsed = presenceSchema.parse(req.body);
  const presence = store.setPresence(req.sessionAuth!.pingUserId, parsed.state);
  emitHubEvent({
    partnerId: req.sessionAuth!.partnerId,
    channel: "presence",
    event: "presence.updated",
    payload: presence,
  });
  res.json({ ok: true, presence });
});
