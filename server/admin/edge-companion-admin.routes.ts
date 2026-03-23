import type { Express, Request, Response } from "express";
import { noStorePrivateJson } from "../middleware/no-store-private-json";
import { fetchUpstreamEdgeServicePath, getEdgeUpstreamBase } from "../edge/upstream-client";

/**
 * Сохранение `config_json.companion` в EDGE (только админ-сессия + секрет EDGE).
 */
export function registerAdminEdgeCompanionRoutes(app: Express): void {
  app.post("/api/admin/edge/companion-config", noStorePrivateJson, async (req: Request, res: Response) => {
    try {
      const edgeId = String(req.body?.edgeId ?? "").trim();
      const companion = req.body?.companion;
      if (!edgeId) {
        res.status(400).json({ message: "Укажите edgeId" });
        return;
      }
      if (!companion || typeof companion !== "object" || Array.isArray(companion)) {
        res.status(400).json({ message: "companion должен быть объектом" });
        return;
      }
      if (!getEdgeUpstreamBase()) {
        res.status(503).json({ message: "EDGE_UPSTREAM_URL не настроен" });
        return;
      }
      const up = await fetchUpstreamEdgeServicePath("/v1/campaign/companion-config", {
        method: "POST",
        body: JSON.stringify({ edgeId, companion }),
      });
      if (!up.ok) {
        res.status(503).json({ message: "EDGE недоступен" });
        return;
      }
      if (up.status === 204) {
        res.status(204).end();
        return;
      }
      res.status(up.status).type("application/json").send(up.body);
    } catch (e) {
      console.error("[admin/edge/companion-config]", e);
      res.status(500).json({ message: "Ошибка сохранения" });
    }
  });
}
