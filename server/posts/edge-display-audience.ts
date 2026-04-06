import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { posts } from "@shared/schema";
import { storage } from "../storage";
import {
  fetchUpstreamCampaignConfig,
  fetchUpstreamParticipantPath,
  getEdgeUpstreamBase,
} from "../edge/upstream-client";

export const EDGE_DISPLAY_AUDIENCES = ["self", "followers", "public"] as const;
export type EdgeDisplayAudience = (typeof EDGE_DISPLAY_AUDIENCES)[number];

export function normalizeEdgeDisplayAudience(raw: string | null | undefined): EdgeDisplayAudience {
  const s = (raw ?? "public").toLowerCase().trim();
  if (s === "self" || s === "followers") return s;
  return "public";
}

/** Из тела ответа GET /v1/companion/campaign-config (JSON). */
export function parseDisplayAudienceFromCompanionJson(bodyText: string): EdgeDisplayAudience {
  try {
    const j = JSON.parse(bodyText) as { displayAudience?: unknown };
    if (typeof j.displayAudience === "string") {
      return normalizeEdgeDisplayAudience(j.displayAudience);
    }
  } catch {
    /* ignore */
  }
  return "public";
}

export async function resolveEdgeDisplayAudienceFromUpstream(edgeId: string): Promise<EdgeDisplayAudience> {
  const up = await fetchUpstreamCampaignConfig(edgeId.trim());
  if (!up.ok || up.status < 200 || up.status >= 300) {
    return "public";
  }
  return parseDisplayAudienceFromCompanionJson(up.body);
}

export async function syncPostsEdgeDisplayAudience(edgeId: string, audienceRaw: string | undefined): Promise<void> {
  const eid = edgeId.trim();
  if (!eid) return;
  const audience = normalizeEdgeDisplayAudience(audienceRaw);
  const db = getDb();
  await db.update(posts).set({ edgeDisplayAudience: audience }).where(eq(posts.edgeId, eid));
}

export type PushEdgeDisplayAudienceResult = { ok: true } | { ok: false; status: number; message: string };

/**
 * Сохраняет displayAudience в конфиге кампании на EDGE
 * и синхронизирует колонку posts.edge_display_audience для всех постов с этим edge_id.
 */
export async function pushEdgeDisplayAudienceToCreatorUpstream(
  edgeId: string,
  platformUserId: string,
  audienceRaw: string | null | undefined,
): Promise<PushEdgeDisplayAudienceResult> {
  const eid = edgeId.trim();
  if (!eid) {
    return { ok: false, status: 400, message: "Нет идентификатора кампании EDGE" };
  }
  const normalized = normalizeEdgeDisplayAudience(audienceRaw);

  if (!getEdgeUpstreamBase()) {
    return {
      ok: false,
      status: 503,
      message:
        "EDGE не подключён: задайте EDGE_UPSTREAM_URL (или EDGE_URL) и EDGE_SERVICE_SECRET в .env и запустите сервис EDGE.",
    };
  }

  const id = encodeURIComponent(eid);
  const up = await fetchUpstreamParticipantPath(`/v1/creator/campaigns/${id}`, {
    method: "PATCH",
    platformUserId,
    body: JSON.stringify({ displayAudience: normalized }),
  });

  if (!up.ok) {
    return { ok: false, status: 503, message: "Сервис EDGE временно недоступен" };
  }
  if (up.status < 200 || up.status >= 300) {
    let msg = "Не удалось сохранить аудиторию в кампании EDGE";
    try {
      const j = JSON.parse(up.body || "{}") as { message?: string; error?: string };
      if (typeof j.message === "string" && j.message.trim()) msg = j.message.trim();
      else if (typeof j.error === "string" && j.error.trim()) msg = j.error.trim();
    } catch {
      /* ignore */
    }
    const st = up.status >= 400 && up.status < 600 ? up.status : 502;
    return { ok: false, status: st, message: msg };
  }

  await syncPostsEdgeDisplayAudience(eid, normalized);
  return { ok: true };
}

type RowWithEdge = {
  id: string;
  authorId: string;
  edgeId: string | null;
  edgeDisplayAudience: string | null;
};

/**
 * Фильтр постов с EDGE по настройке «кто видит» (лента / поиск / снапшот).
 */
export async function filterFeedRowsForEdgeAudience<T extends RowWithEdge>(viewerId: string, rows: T[]): Promise<T[]> {
  const needFollowCheck = rows.filter(
    (r) =>
      r.edgeId &&
      normalizeEdgeDisplayAudience(r.edgeDisplayAudience) === "followers" &&
      r.authorId !== viewerId,
  );
  const authorIds = [...new Set(needFollowCheck.map((r) => r.authorId))];
  const followingSet = new Set<string>();
  if (authorIds.length > 0) {
    await Promise.all(
      authorIds.map(async (aid) => {
        if (await storage.isFollowing(viewerId, aid)) followingSet.add(aid);
      }),
    );
  }

  return rows.filter((r) => {
    if (!r.edgeId) return true;
    const aud = normalizeEdgeDisplayAudience(r.edgeDisplayAudience);
    if (aud === "public") return true;
    if (r.authorId === viewerId) return true;
    if (aud === "self") return false;
    return followingSet.has(r.authorId);
  });
}
