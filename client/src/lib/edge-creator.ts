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
  if (code === "no_eligible_participants") {
    return "Нет подходящих участников: все уже получили этот приз или пул пуст.";
  }
  if (code === "edge_id_required" || code === "edgeId_required") {
    return "Не указан идентификатор кампании.";
  }
  if (code === "business_status_required") {
    return "EDGE доступен только для бизнес-аккаунтов со статусом approved.";
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
  leaderboardPrimaryEnabled?: boolean;
  leaderboardSecondaryEnabled?: boolean;
  /** Учитывает дату розыгрыша призов и ручную заморозку в БД. */
  leaderboardPrimaryFrozenEffective?: boolean;
  leaderboardSecondaryFrozenEffective?: boolean;
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
  /** ISO — момент розыгрыша; после него начисление в рейтинг(и) останавливается, пока создатель не сбросит паузу. */
  drawAt?: string | null;
  leaderboardScopes?: Array<"primary" | "secondary">;
  /** ЛС победителю этого приза (вкл. + текст/медиа), как за подписку. */
  winnerDm?: { enabled: boolean; text: string; mediaUrl: string | null };
};

export type EdgeCampaignPatch = {
  title?: string;
  status?: string;
  companionCharacter?: { assetUrl?: string; displayName?: string };
  companionIntroText?: string;
  giftsTemplates?: EdgeGiftTemplateInput[];
  followRewardEnabled?: boolean;
  leaderboardGlobalEnabled?: boolean;
  leaderboardPrimaryEnabled?: boolean;
  leaderboardSecondaryEnabled?: boolean;
  leaderboardPrimaryPrizeDrawRankingFreezeLifted?: boolean;
  leaderboardSecondaryPrizeDrawRankingFreezeLifted?: boolean;
  leaderboardPrimaryFrozenAtClear?: boolean;
  leaderboardSecondaryFrozenAtClear?: boolean;
  prizeRules?: { pool?: string; method?: string; topN?: number; rankingKind?: "primary" | "secondary" };
  schedule?: {
    drawSummary?: string;
    leaderboardResetSummary?: string;
    endsAt?: string | null;
  };
  followRewardDm?: { enabled?: boolean; text?: string; mediaUrl?: string | null };
  pingInviteDm?: {
    template?: string;
    codeExpiresInHours?: number;
    inviteIssueMode?: "batch_min_count" | "single_per_request" | "one_multi_use";
    multiUseRegistrations?: number;
  } | null;
  taskPresets?: { game?: unknown[]; global?: unknown[]; commercial?: unknown[] };
  /** Видимость поста с кампанией: только себе | подписчикам | всем в общей ленте. */
  displayAudience?: "self" | "followers" | "public";
  /** EDGE MONEY — `config_json.money` на микросервисе EDGE. */
  moneyConfig?: {
    headline?: string;
    mediaUrl?: string | null;
    colorScheme?: string;
    scoringRules?: Array<{
      id?: string;
      kind: string;
      threshold: number;
      points: number;
      enabled?: boolean;
      maxPointsPerDay?: number;
    }>;
    prizeTiers?: Array<{
      id?: string;
      fromRank: number;
      toRank: number;
      label: string;
      templateKey?: string;
    }>;
    inviteDm?: { template?: string; codeExpiresInHours?: number } | null;
  };
  companionLifeSimulation?: {
    enabled?: boolean;
    lifeRating?: { min?: number; max?: number; initial?: number };
    intervalsHours?: { feed?: number; toilet?: number; play?: number; calm?: number };
    responseWindowHours?: number;
    onTimeBonus?: number;
    missedPenalty?: number;
    queueFulfillBonus?: number;
    maxMoodBonus?: number;
    maxQueuePerKind?: number;
  } | null;
};

/** Сводка по рейтингу жизни участников (только владелец кампании). */
export type EdgeCampaignLifeStats = {
  edgeId: string;
  totalParticipants: number;
  withCharacterState: number;
  withLifeRating: number;
  avgLifeRating: number | null;
  minLifeRating: number | null;
  maxLifeRating: number | null;
  totalQueuedNeeds: number;
  participantsWithPendingQueue: number;
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

export async function fetchEdgeCampaignLifeStats(edgeId: string): Promise<EdgeCampaignLifeStats> {
  const id = encodeURIComponent(edgeId.trim());
  const res = await apiFetch(`${API}/edge/creator/campaigns/${id}/life-stats`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const t = (await res.text()) || res.statusText;
    throw new Error(formatEdgeCreatorApiError(res.status, t));
  }
  const data = (await res.json()) as { stats?: EdgeCampaignLifeStats };
  if (!data.stats?.edgeId) {
    throw new Error("Некорректный ответ статистики");
  }
  return data.stats;
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
    const row: EdgeGiftTemplateInput = {
      ...(key ? { key } : {}),
      title: title.trim(),
      ...(typeof o.description === "string" ? { description: o.description } : {}),
      ...(typeof o.quantity === "number" ? { quantity: o.quantity } : {}),
      ...(typeof o.imageUrl === "string" ? { imageUrl: o.imageUrl } : {}),
      ...(typeof o.videoUrl === "string" ? { videoUrl: o.videoUrl } : {}),
    };
    if (o.drawAt === null) {
      row.drawAt = null;
    } else if (typeof o.drawAt === "string" && o.drawAt.trim()) {
      const ts = Date.parse(o.drawAt);
      if (Number.isFinite(ts)) row.drawAt = new Date(ts).toISOString();
    }
    if (Array.isArray(o.leaderboardScopes)) {
      const scopes = o.leaderboardScopes.filter((s): s is "primary" | "secondary" => s === "primary" || s === "secondary");
      if (scopes.length) row.leaderboardScopes = scopes;
    }
    const wdm = o.winnerDm;
    if (wdm && typeof wdm === "object" && !Array.isArray(wdm)) {
      const d = wdm as Record<string, unknown>;
      row.winnerDm = {
        enabled: d.enabled === true,
        text: typeof d.text === "string" ? d.text : "",
        mediaUrl:
          d.mediaUrl === null || d.mediaUrl === ""
            ? null
            : typeof d.mediaUrl === "string" && d.mediaUrl.trim()
              ? d.mediaUrl.trim()
              : null,
      };
    }
    out.push(row);
  }
  return out;
}

export type EdgeCreatorPrizeDrawBody = {
  giftKey?: string;
  count?: number;
  pool?: "all" | "top";
  method?: "random" | "first";
  topN?: number;
  rankingKind?: "primary" | "secondary";
  /** По умолчанию true — ЛС победителям от вашего имени. */
  notify?: boolean;
};

export type EdgeCreatorPrizeDrawNotifications = {
  attempted: boolean;
  senderUserId: string | null;
  skippedReason?: string;
  results: { platformUserId: string; ok: boolean; error?: string }[];
};

/** Расшифровка кодов ошибок ЛС после розыгрыша (сервер `prize-draw-notify`). */
export function formatPrizeDmNotifyError(code: string | undefined): string {
  const c = (code ?? "").trim();
  if (!c) return "ошибка";
  const map: Record<string, string> = {
    invalid_platform_user_id: "некорректный ID в данных победителя",
    invalid_sender_id: "некорректный ID отправителя",
    too_many_recipients: "слишком много адресатов в одном запросе",
    winner_list_integrity_mismatch: "несовпадение списка победителей с сервисом — ЛС не отправлялись",
    dm_not_strict_pair: "чат не 1:1 — сообщение не отправлено",
    dm_peer_mismatch: "состав чата не совпал с ожидаемым",
    send_failed: "не удалось отправить",
  };
  return map[c] ?? c;
}

export type EdgeCreatorPrizeDrawResult = {
  edgeId: string;
  campaignTitle: string;
  drawBatchId: string;
  giftKey: string;
  giftLabel: string;
  poolSize: number;
  requestedCount: number;
  drawnCount: number;
  winners: { platformUserId: string; giftKey: string; giftLabel: string }[];
  notifications?: EdgeCreatorPrizeDrawNotifications;
};

export async function postEdgeCreatorPrizeDraw(
  edgeId: string,
  body: EdgeCreatorPrizeDrawBody,
): Promise<EdgeCreatorPrizeDrawResult> {
  const id = encodeURIComponent(edgeId.trim());
  const res = await apiFetch(`${API}/edge/creator/campaigns/${id}/prize-draw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = (await res.text()) || res.statusText;
    throw new Error(formatEdgeCreatorApiError(res.status, t));
  }
  return (await res.json()) as EdgeCreatorPrizeDrawResult;
}
