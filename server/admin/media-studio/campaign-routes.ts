import type { Express, Request, Response } from "express";
import { z } from "zod";
import { writeAuditLog } from "../audit";
import { requireAdminOrSuper } from "../middleware";
import {
  addCampaignPostBodySchema,
  addMediaStudioCampaignPost,
  campaignPostToJson,
  campaignToJson,
  createMediaStudioCampaign,
  deleteMediaStudioCampaignPost,
  enrichCampaignPosts,
  getMediaStudioCampaignById,
  listCampaignPosts,
  listMediaStudioCampaigns,
  countQueuedPostsByCampaignIds,
  patchCampaignBodySchema,
  patchMediaStudioCampaign,
  processDuePostsForCampaign,
  processRunningMediaStudioCampaigns,
} from "./campaign-service";

const createCampaignBodySchema = z.object({
  title: z.string().max(200).nullable().optional(),
});

function paramId(req: Request, name: string): string {
  const p = req.params[name];
  return Array.isArray(p) ? p[0] ?? "" : p ?? "";
}

export function registerMediaStudioCampaignRoutes(app: Express): void {
  app.get("/api/admin/media-studio/campaigns", requireAdminOrSuper, async (_req: Request, res: Response) => {
    try {
      const rows = await listMediaStudioCampaigns();
      const ids = rows.map((r) => r.id);
      const queuedBy = await countQueuedPostsByCampaignIds(ids);
      res.json({
        campaigns: rows.map((c) => ({
          ...campaignToJson(c),
          queuedCount: queuedBy.get(c.id) ?? 0,
        })),
      });
    } catch (e) {
      console.error("media-studio campaigns list", e);
      res.status(500).json({ message: "Ошибка списка кампаний" });
    }
  });

  app.post("/api/admin/media-studio/campaigns", requireAdminOrSuper, async (req: Request, res: Response) => {
    const adminUserId = (req as Request & { adminUserId: string }).adminUserId;
    const parsed = createCampaignBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "Некорректные данные", issues: parsed.error.flatten() });
      return;
    }
    try {
      const titleRaw = parsed.data.title;
      const title =
        titleRaw === null || titleRaw === undefined ? null : titleRaw.trim() ? titleRaw.trim().slice(0, 200) : null;
      const row = await createMediaStudioCampaign(adminUserId, title);
      await writeAuditLog({
        adminId: adminUserId,
        action: "media_studio.campaign.create",
        targetType: "media_studio_campaign",
        targetId: row.id,
        details: title ? { title } : undefined,
        ip: req.ip,
      });
      res.status(201).json({ campaign: campaignToJson(row) });
    } catch (e) {
      console.error("media-studio campaign create", e);
      res.status(500).json({ message: "Не удалось создать кампанию" });
    }
  });

  app.get("/api/admin/media-studio/campaigns/:id", requireAdminOrSuper, async (req: Request, res: Response) => {
    const id = paramId(req, "id");
    try {
      const campaign = await getMediaStudioCampaignById(id);
      if (!campaign) {
        res.status(404).json({ message: "Кампания не найдена" });
        return;
      }
      const posts = await listCampaignPosts(id);
      const enriched = await enrichCampaignPosts(posts);
      res.json({
        campaign: campaignToJson(campaign),
        posts: enriched,
      });
    } catch (e) {
      console.error("media-studio campaign get", e);
      res.status(500).json({ message: "Ошибка загрузки кампании" });
    }
  });

  app.patch("/api/admin/media-studio/campaigns/:id", requireAdminOrSuper, async (req: Request, res: Response) => {
    const adminUserId = (req as Request & { adminUserId: string }).adminUserId;
    const id = paramId(req, "id");
    const parsed = patchCampaignBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Некорректные данные", issues: parsed.error.flatten() });
      return;
    }
    try {
      const updated = await patchMediaStudioCampaign(id, parsed.data);
      if (!updated) {
        res.status(404).json({ message: "Кампания не найдена" });
        return;
      }
      await writeAuditLog({
        adminId: adminUserId,
        action: "media_studio.campaign.update",
        targetType: "media_studio_campaign",
        targetId: id,
        details: {
          ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
          ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        },
        ip: req.ip,
      });
      res.json({ campaign: campaignToJson(updated) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      if (msg.includes("Недопустимый переход")) {
        res.status(400).json({ message: msg });
        return;
      }
      console.error("media-studio campaign patch", e);
      res.status(500).json({ message: "Не удалось обновить кампанию" });
    }
  });

  app.post("/api/admin/media-studio/campaigns/:id/posts", requireAdminOrSuper, async (req: Request, res: Response) => {
    const adminUserId = (req as Request & { adminUserId: string }).adminUserId;
    const id = paramId(req, "id");
    const parsed = addCampaignPostBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Некорректные данные", issues: parsed.error.flatten() });
      return;
    }
    try {
      const row = await addMediaStudioCampaignPost(id, parsed.data);
      await writeAuditLog({
        adminId: adminUserId,
        action: "media_studio.campaign.post.add",
        targetType: "media_studio_campaign_post",
        targetId: row.id,
        details: { campaignId: id },
        ip: req.ip,
      });
      res.status(201).json({ post: { ...campaignPostToJson(row), publishedPath: null } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      if (
        msg.includes("синтетическ") ||
        msg.includes("Нужен текст") ||
        msg.includes("Некорректная дата") ||
        msg.includes("Кампания") ||
        msg.includes("завершена") ||
        msg.includes("отменена")
      ) {
        res.status(400).json({ message: msg });
        return;
      }
      console.error("media-studio campaign post add", e);
      res.status(500).json({ message: "Не удалось добавить в очередь" });
    }
  });

  app.delete("/api/admin/media-studio/campaigns/:id/posts/:postId", requireAdminOrSuper, async (req: Request, res: Response) => {
    const adminUserId = (req as Request & { adminUserId: string }).adminUserId;
    const postId = paramId(req, "postId");
    try {
      const ok = await deleteMediaStudioCampaignPost(postId);
      if (!ok) {
        res.status(404).json({ message: "Элемент не найден или уже не в очереди" });
        return;
      }
      await writeAuditLog({
        adminId: adminUserId,
        action: "media_studio.campaign.post.delete",
        targetType: "media_studio_campaign_post",
        targetId: postId,
        ip: req.ip,
      });
      res.status(204).end();
    } catch (e) {
      console.error("media-studio campaign post delete", e);
      res.status(500).json({ message: "Не удалось удалить" });
    }
  });

  app.post("/api/admin/media-studio/campaigns/:id/tick", requireAdminOrSuper, async (req: Request, res: Response) => {
    const adminUserId = (req as Request & { adminUserId: string }).adminUserId;
    const id = paramId(req, "id");
    try {
      const campaign = await getMediaStudioCampaignById(id);
      if (!campaign) {
        res.status(404).json({ message: "Кампания не найдена" });
        return;
      }
      if (campaign.status !== "running") {
        res.status(400).json({ message: "Запустите кампанию (статус «Идёт»), затем обработайте очередь" });
        return;
      }
      const result = await processDuePostsForCampaign(id);
      await writeAuditLog({
        adminId: adminUserId,
        action: "media_studio.campaign.tick",
        targetType: "media_studio_campaign",
        targetId: id,
        details: result,
        ip: req.ip,
      });
      res.json(result);
    } catch (e) {
      console.error("media-studio campaign tick", e);
      res.status(500).json({ message: "Ошибка обработки очереди" });
    }
  });

  app.post("/api/admin/media-studio/campaigns/tick-all", requireAdminOrSuper, async (req: Request, res: Response) => {
    const adminUserId = (req as Request & { adminUserId: string }).adminUserId;
    try {
      const result = await processRunningMediaStudioCampaigns();
      await writeAuditLog({
        adminId: adminUserId,
        action: "media_studio.campaign.tick_all",
        targetType: "media_studio",
        details: result,
        ip: req.ip,
      });
      res.json(result);
    } catch (e) {
      console.error("media-studio campaigns tick-all", e);
      res.status(500).json({ message: "Ошибка обработки кампаний" });
    }
  });
}
