import { Router, type Request, type Response } from "express";
import { requireParserServiceSecret } from "../middleware/require-parser-secret.js";
import {
  adminApproveItem,
  adminCreateBinding,
  adminDeleteBinding,
  adminListBindings,
  adminListItems,
  adminRejectItem,
  adminRunAllEnabledNow,
  adminRunBindingNow,
  adminTestVkToken,
  adminUpdateBinding,
} from "../parser/service.js";

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): (req: Request, res: Response) => void {
  return (req, res) => {
    void fn(req, res).catch((e) => {
      console.error("[parser] route", e);
      if (res.headersSent) return;
      const msg = e instanceof Error ? e.message : "Ошибка";
      res.status(400).json({ message: msg });
    });
  };
}

export function createV1AdminRouter(): Router {
  const r = Router();
  r.use(requireParserServiceSecret);

  r.get(
    "/bindings",
    asyncHandler(async (_req, res) => {
      const bindings = await adminListBindings();
      res.json({ bindings });
    }),
  );

  r.post(
    "/bindings",
    asyncHandler(async (req, res) => {
      const row = await adminCreateBinding({
        platformUserId: String(req.body?.platformUserId ?? "").trim(),
        vkAccessToken: String(req.body?.vkAccessToken ?? ""),
        vkOwnerId: String(req.body?.vkOwnerId ?? ""),
        displayName: req.body?.displayName ?? null,
        parseIntervalMinutes: Number(req.body?.parseIntervalMinutes),
        postsPerRun: Number(req.body?.postsPerRun),
        requireModeration: req.body?.requireModeration,
        visibility: req.body?.visibility,
        cityLine: req.body?.cityLine ?? null,
        enabled: req.body?.enabled,
      });
      res.status(201).json({ binding: row });
    }),
  );

  r.patch(
    "/bindings/:id",
    asyncHandler(async (req, res) => {
      const id = String(req.params.id ?? "").trim();
      const row = await adminUpdateBinding(id, req.body ?? {});
      if (!row) {
        res.status(404).json({ message: "Не найдено" });
        return;
      }
      res.json({ binding: row });
    }),
  );

  r.delete(
    "/bindings/:id",
    asyncHandler(async (req, res) => {
      const id = String(req.params.id ?? "").trim();
      const ok = await adminDeleteBinding(id);
      if (!ok) {
        res.status(404).json({ message: "Не найдено" });
        return;
      }
      res.json({ ok: true });
    }),
  );

  r.post(
    "/bindings/:id/run",
    asyncHandler(async (req, res) => {
      const id = String(req.params.id ?? "").trim();
      const result = await adminRunBindingNow(id);
      res.json(result);
    }),
  );

  r.post(
    "/run-all",
    asyncHandler(async (_req, res) => {
      const results = await adminRunAllEnabledNow();
      res.json({ results });
    }),
  );

  r.get(
    "/items",
    asyncHandler(async (req, res) => {
      const bindingId = typeof req.query.bindingId === "string" ? req.query.bindingId : undefined;
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const limit = Number(req.query.limit) || 40;
      const offset = Number(req.query.offset) || 0;
      const { items, total } = await adminListItems({ bindingId, status, limit, offset });
      res.json({ items, total });
    }),
  );

  r.post(
    "/items/:id/approve",
    asyncHandler(async (req, res) => {
      const id = String(req.params.id ?? "").trim();
      const result = await adminApproveItem(id);
      res.json(result);
    }),
  );

  r.post(
    "/items/:id/reject",
    asyncHandler(async (req, res) => {
      const id = String(req.params.id ?? "").trim();
      await adminRejectItem(id);
      res.json({ ok: true });
    }),
  );

  r.post(
    "/test-token",
    asyncHandler(async (req, res) => {
      const token = String(req.body?.token ?? "");
      const result = await adminTestVkToken(token);
      res.json(result);
    }),
  );

  return r;
}
