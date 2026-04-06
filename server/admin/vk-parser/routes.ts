import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { writeAuditLog } from "../audit";
import { proxyParserRequest, sendParserProxyResponse } from "../../parser/proxy";

type ReqWithAdmin = Request & { adminUserId: string };

function queryFromReq(req: Request): string {
  const raw = typeof req.originalUrl === "string" ? req.originalUrl : req.url;
  const q = raw.includes("?") ? raw.split("?")[1] ?? "" : "";
  return q;
}

export function registerAdminVkParserRoutes(app: Express): void {
  app.get("/api/admin/vk-parser/bindings", async (req: Request, res: Response) => {
    const pr = await proxyParserRequest("GET", "/v1/bindings", { requestId: req.requestId });
    sendParserProxyResponse(res, pr);
  });

  app.post("/api/admin/vk-parser/bindings", async (req: Request, res: Response) => {
    try {
      const adminUserId = (req as ReqWithAdmin).adminUserId;
      const platformUserId = String(req.body?.platformUserId ?? "").trim();
      const user = await storage.getUser(platformUserId);
      if (!user || user.deletedAt) {
        res.status(400).json({ message: "Пользователь не найден или удалён" });
        return;
      }
      const pr = await proxyParserRequest("POST", "/v1/bindings", {
        requestId: req.requestId,
        body: JSON.stringify(req.body ?? {}),
      });
      if (pr.ok && pr.status >= 200 && pr.status < 300) {
        try {
          const j = JSON.parse(pr.text) as { binding?: { id: string; platformUserId: string; vkOwnerId: string } };
          if (j.binding) {
            await writeAuditLog({
              adminId: adminUserId,
              action: "vk_parser.binding.create",
              targetType: "vk_parser_binding",
              targetId: j.binding.id,
              details: { platformUserId: j.binding.platformUserId, vkOwnerId: j.binding.vkOwnerId },
              ip: req.ip,
            });
          }
        } catch {
          /* ignore audit parse */
        }
      }
      sendParserProxyResponse(res, pr);
    } catch (e) {
      console.error("vk-parser create binding", e);
      res.status(500).json({ message: "Ошибка прокси парсера" });
    }
  });

  app.patch("/api/admin/vk-parser/bindings/:id", async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const id = String(req.params.id ?? "").trim();
    const pr = await proxyParserRequest("PATCH", `/v1/bindings/${encodeURIComponent(id)}`, {
      requestId: req.requestId,
      body: JSON.stringify(req.body ?? {}),
    });
    if (pr.ok && pr.status >= 200 && pr.status < 300) {
      await writeAuditLog({
        adminId: adminUserId,
        action: "vk_parser.binding.update",
        targetType: "vk_parser_binding",
        targetId: id,
        details: { patch: Object.keys(req.body ?? {}) },
        ip: req.ip,
      });
    }
    sendParserProxyResponse(res, pr);
  });

  app.delete("/api/admin/vk-parser/bindings/:id", async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const id = String(req.params.id ?? "").trim();
    const pr = await proxyParserRequest("DELETE", `/v1/bindings/${encodeURIComponent(id)}`, {
      requestId: req.requestId,
    });
    if (pr.ok && pr.status >= 200 && pr.status < 300) {
      await writeAuditLog({
        adminId: adminUserId,
        action: "vk_parser.binding.delete",
        targetType: "vk_parser_binding",
        targetId: id,
        ip: req.ip,
      });
    }
    sendParserProxyResponse(res, pr);
  });

  app.post("/api/admin/vk-parser/bindings/:id/run", async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const id = String(req.params.id ?? "").trim();
    const pr = await proxyParserRequest("POST", `/v1/bindings/${encodeURIComponent(id)}/run`, {
      requestId: req.requestId,
    });
    if (pr.ok && pr.status >= 200 && pr.status < 300) {
      try {
        const details = JSON.parse(pr.text) as Record<string, unknown>;
        await writeAuditLog({
          adminId: adminUserId,
          action: "vk_parser.binding.run",
          targetType: "vk_parser_binding",
          targetId: id,
          details,
          ip: req.ip,
        });
      } catch {
        await writeAuditLog({
          adminId: adminUserId,
          action: "vk_parser.binding.run",
          targetType: "vk_parser_binding",
          targetId: id,
          ip: req.ip,
        });
      }
    }
    sendParserProxyResponse(res, pr);
  });

  app.post("/api/admin/vk-parser/run-all", async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const pr = await proxyParserRequest("POST", "/v1/run-all", { requestId: req.requestId });
    if (pr.ok && pr.status >= 200 && pr.status < 300) {
      try {
        const j = JSON.parse(pr.text) as { results?: unknown };
        await writeAuditLog({
          adminId: adminUserId,
          action: "vk_parser.run_all",
          targetType: "vk_parser",
          details: { results: j.results },
          ip: req.ip,
        });
      } catch {
        await writeAuditLog({
          adminId: adminUserId,
          action: "vk_parser.run_all",
          targetType: "vk_parser",
          ip: req.ip,
        });
      }
    }
    sendParserProxyResponse(res, pr);
  });

  app.get("/api/admin/vk-parser/items", async (req: Request, res: Response) => {
    const pr = await proxyParserRequest("GET", "/v1/items", {
      query: queryFromReq(req),
      requestId: req.requestId,
    });
    sendParserProxyResponse(res, pr);
  });

  app.post("/api/admin/vk-parser/items/:id/approve", async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const id = String(req.params.id ?? "").trim();
    const pr = await proxyParserRequest("POST", `/v1/items/${encodeURIComponent(id)}/approve`, {
      requestId: req.requestId,
    });
    if (pr.ok && pr.status >= 200 && pr.status < 300) {
      try {
        const details = JSON.parse(pr.text) as { platformPostId?: string };
        await writeAuditLog({
          adminId: adminUserId,
          action: "vk_parser.item.approve",
          targetType: "vk_parser_item",
          targetId: id,
          details,
          ip: req.ip,
        });
      } catch {
        await writeAuditLog({
          adminId: adminUserId,
          action: "vk_parser.item.approve",
          targetType: "vk_parser_item",
          targetId: id,
          ip: req.ip,
        });
      }
    }
    sendParserProxyResponse(res, pr);
  });

  app.post("/api/admin/vk-parser/items/:id/reject", async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const id = String(req.params.id ?? "").trim();
    const pr = await proxyParserRequest("POST", `/v1/items/${encodeURIComponent(id)}/reject`, {
      requestId: req.requestId,
    });
    if (pr.ok && pr.status >= 200 && pr.status < 300) {
      await writeAuditLog({
        adminId: adminUserId,
        action: "vk_parser.item.reject",
        targetType: "vk_parser_item",
        targetId: id,
        ip: req.ip,
      });
    }
    sendParserProxyResponse(res, pr);
  });

  app.post("/api/admin/vk-parser/test-token", async (req: Request, res: Response) => {
    const pr = await proxyParserRequest("POST", "/v1/test-token", {
      requestId: req.requestId,
      body: JSON.stringify({ token: String(req.body?.token ?? "") }),
    });
    sendParserProxyResponse(res, pr);
  });
}
