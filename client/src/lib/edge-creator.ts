import { API, apiFetch } from "@/lib/api-base";

/** Расшифровка JSON-ошибок `/api/edge/*` вместо сырого `{"error":"…"}` в тосте. */
export function formatEdgeCreatorApiError(status: number, bodyText: string): string {
  const raw = (bodyText || "").trim();
  let code: string | null = null;
  try {
    const j = JSON.parse(raw) as { error?: string; message?: string };
    if (typeof j.message === "string" && j.message.trim()) return j.message.trim();
    if (typeof j.error === "string") code = j.error;
  } catch {
    /* не JSON — покажем как есть */
  }
  if (code === "edge_upstream_not_configured") {
    return "EDGE не подключён: в .env на сервере задайте EDGE_UPSTREAM_URL (напр. http://127.0.0.1:3092) и EDGE_SERVICE_SECRET, запустите процесс EDGE. Подробнее: deploy.env.example, EDGE/README.md.";
  }
  if (code === "edge_participant_unavailable" || code === "edge_companion_unavailable") {
    return "Сервис EDGE недоступен: проверьте, что он запущен, в .env есть EDGE_DATABASE_URL и выполнены миграции EDGE.";
  }
  if (code === "edge_id_required" || code === "edgeId_required") {
    return "Не указан идентификатор кампании.";
  }
  if (raw) return raw.length > 280 ? `${raw.slice(0, 280)}…` : raw;
  return status === 503 ? "Сервис временно недоступен (503)." : `Ошибка запроса (${status}).`;
}

/** Тост на мобильных: короткий title + description вместо обрезанной простыни. */
export function edgeCreatorDestructiveToast(e: unknown): { title: string; description?: string } {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("EDGE_UPSTREAM_URL") && msg.includes("EDGE_SERVICE_SECRET")) {
    return {
      title: "EDGE не подключён к платформе",
      description:
        "В deploy.env на VPS: EDGE_UPSTREAM_URL=http://127.0.0.1:3092, EDGE_SERVICE_SECRET (одинаковый у ping-moot и EDGE), EDGE_DATABASE_URL, EDGE_PM2_ENABLED=1. Затем npm run deploy.",
    };
  }
  return { title: msg.length > 160 ? `${msg.slice(0, 157)}…` : msg };
}

export type EdgeCreatorCampaignSummary = {
  edgeId: string;
  title: string;
  status: string;
  edgeType: string;
  updatedAt: string;
  participantCount: number;
};

export type EdgeCreatorCampaignDetail = {
  edgeId: string;
  title: string;
  status: string;
  edgeType: string;
  giftsJson: unknown;
  followRewardEnabled: boolean;
  leaderboardGlobalEnabled: boolean;
  configJson: unknown;
  updatedAt: string;
};

export type EdgeGiftTemplateInput = {
  key?: string;
  title: string;
  description?: string;
  quantity?: number;
  imageUrl?: string;
  videoUrl?: string;
};

export type EdgeCampaignPatch = {
  title?: string;
  status?: string;
  companionCharacter?: { assetUrl?: string; displayName?: string };
  companionIntroText?: string;
  giftsTemplates?: EdgeGiftTemplateInput[];
  followRewardEnabled?: boolean;
  leaderboardGlobalEnabled?: boolean;
  prizeRules?: { pool?: string; method?: string; topN?: number };
  schedule?: {
    drawSummary?: string;
    leaderboardResetSummary?: string;
    endsAt?: string | null;
  };
  followRewardDm?: { enabled?: boolean; text?: string; mediaUrl?: string | null };
  pingInviteDm?: { template?: string; codeExpiresInHours?: number } | null;
  taskPresets?: { game?: unknown[]; global?: unknown[]; commercial?: unknown[] };
};

export async function fetchMyEdgeCampaigns(): Promise<EdgeCreatorCampaignSummary[]> {
  const res = await apiFetch(`${API}/edge/my-campaigns`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const t = (await res.text()) || res.statusText;
    throw new Error(formatEdgeCreatorApiError(res.status, t));
  }
  const data = (await res.json()) as { campaigns?: EdgeCreatorCampaignSummary[] };
  return Array.isArray(data.campaigns) ? data.campaigns : [];
}

export async function fetchEdgeCampaignDetail(edgeId: string): Promise<EdgeCreatorCampaignDetail> {
  const id = encodeURIComponent(edgeId.trim());
  const res = await apiFetch(`${API}/edge/creator/campaigns/${id}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const t = (await res.text()) || res.statusText;
    throw new Error(formatEdgeCreatorApiError(res.status, t));
  }
  const data = (await res.json()) as { campaign?: EdgeCreatorCampaignDetail };
  if (!data.campaign?.edgeId) {
    throw new Error("Некорректный ответ сервера");
  }
  return data.campaign;
}

export async function createEdgeCampaignDraft(body: {
  title: string;
  edgeType?: string;
}): Promise<{ edgeId: string; title: string }> {
  const res = await apiFetch(`${API}/edge/creator/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      title: body.title.trim(),
      edgeType: body.edgeType ?? "character",
    }),
  });
  if (!res.ok) {
    const t = (await res.text()) || res.statusText;
    throw new Error(formatEdgeCreatorApiError(res.status, t));
  }
  const data = (await res.json()) as { edgeId?: string; title?: string };
  if (!data.edgeId) throw new Error("Нет edgeId в ответе");
  return { edgeId: data.edgeId, title: data.title ?? body.title };
}

export async function patchEdgeCampaign(edgeId: string, patch: EdgeCampaignPatch): Promise<void> {
  const id = encodeURIComponent(edgeId.trim());
  const res = await apiFetch(`${API}/edge/creator/campaigns/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const t = (await res.text()) || res.statusText;
    throw new Error(formatEdgeCreatorApiError(res.status, t));
  }
}

/** Достаёт шаблоны призов из `giftsJson` (массив или `{ templates }`). */
export function parseGiftTemplatesFromRow(giftsJson: unknown): EdgeGiftTemplateInput[] {
  let list: unknown[] = [];
  if (Array.isArray(giftsJson)) list = giftsJson;
  else if (giftsJson && typeof giftsJson === "object" && Array.isArray((giftsJson as { templates?: unknown[] }).templates)) {
    list = (giftsJson as { templates: unknown[] }).templates;
  }
  const out: EdgeGiftTemplateInput[] = [];
  for (const x of list) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title : typeof o.name === "string" ? o.name : "";
    if (!title.trim()) continue;
    const key = typeof o.key === "string" ? o.key : typeof o.id === "string" ? o.id : undefined;
    out.push({
      ...(key ? { key } : {}),
      title: title.trim(),
      ...(typeof o.description === "string" ? { description: o.description } : {}),
      ...(typeof o.quantity === "number" ? { quantity: o.quantity } : {}),
      ...(typeof o.imageUrl === "string" ? { imageUrl: o.imageUrl } : {}),
      ...(typeof o.videoUrl === "string" ? { videoUrl: o.videoUrl } : {}),
    });
  }
  return out;
}
