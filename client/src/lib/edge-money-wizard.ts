/** Состояние мастера EDGE MONEY (борд) — короткие подписи и данные для PATCH. */

export const MONEY_WIZARD_STEPS = [
  "Старт",
  "Карточка",
  "Баллы",
  "Места",
  "Рейтинги",
  "Сроки",
  "Готово",
] as const;

export type MoneyScoringKind =
  | "invite_friend"
  | "chat_messages"
  | "video_call_minutes"
  | "follow_creator"
  | "post_created"
  | "profile_likes_received";

export type MoneyScoringCardState = {
  kind: MoneyScoringKind;
  stableId: string;
  enabled: boolean;
  threshold: number;
  points: number;
  /** Макс. баллов за сутки UTC для правил с дневным потолком; 0 = без лимита. */
  maxPointsPerDay: number;
};

export type MoneyTierFormRow = {
  localId: string;
  id: string;
  fromRank: number;
  toRank: number;
  label: string;
};

/**
 * Правила с threshold=1 по природе (одно действие = начисление).
 * Для них порог скрыт, показываем только «баллы» и «лимит в день».
 */
export const SINGLE_ACTION_KINDS: ReadonlySet<MoneyScoringKind> = new Set([
  "invite_friend",
  "follow_creator",
]);

/** Заголовок карточки + одна строка «зачем» + раскрываемые детали (без простыней в основном UI). */
export const MONEY_SCORING_UI: Record<
  MoneyScoringKind,
  { title: string; tagline: string; details: string[]; unitShort: string; pointsLabel: string }
> = {
  invite_friend: {
    title: "Пригласи друга",
    tagline: "За регистрацию по коду — баллы в рейтинг, шансы на победу растут сразу.",
    details: ["Начисление после подтверждённой регистрации по вашему коду из игры."],
    unitShort: "друзей",
    pointsLabel: "Баллы за приглашение",
  },
  chat_messages: {
    title: "Сообщения в чате",
    tagline: "Набрал N сообщений в личке — получил очки.",
    details: [
      "Счёт ведётся отдельно по каждому диалогу (не сумма по всем чатам).",
      "Сервисные сценарии и не-ЛС не учитываются.",
    ],
    unitShort: "сообщ.",
    pointsLabel: "Баллов за достижение",
  },
  video_call_minutes: {
    title: "Звонок",
    tagline: "N минут разговора 1:1 (аудио или видео) — очки в рейтинг.",
    details: [
      "Считаются только минуты после соединения обоих абонентов.",
      "Оба участника получают одинаковый вклад минут в свои счётчики.",
      "Групповые созвоны в зачёт не входят.",
    ],
    unitShort: "мин",
    pointsLabel: "Баллов за достижение",
  },
  follow_creator: {
    title: "Подписка на вас",
    tagline: "Подписался на вашу страницу — получил баллы.",
    details: [
      "Одно начисление за кампанию на подписчика (повторная подписка не дублирует).",
      "Работает вместе с обычным follow-reward у персонажа — MONEY считается отдельно.",
    ],
    unitShort: "раз",
    pointsLabel: "Баллы за подписку",
  },
  post_created: {
    title: "Пост в ленте",
    tagline: "Опубликовал пост — получил баллы.",
    details: [
      "Черновики не считаются; публикация при сохранении из черновика — считается.",
    ],
    unitShort: "постов",
    pointsLabel: "Баллов за достижение",
  },
  profile_likes_received: {
    title: "Реакции на посты",
    tagline: "Другие пользователи поставили реакцию на ваш пост.",
    details: [
      "Первая реакция пользователя на пост даёт +1 к счётчику; смена эмодзи не дублирует.",
      "Лайк собственного поста не считается.",
    ],
    unitShort: "реакций",
    pointsLabel: "Баллов за достижение",
  },
};

export const ALL_MONEY_SCORING_KINDS: MoneyScoringKind[] = [
  "invite_friend",
  "chat_messages",
  "video_call_minutes",
  "follow_creator",
  "post_created",
  "profile_likes_received",
];

function defaultThreshold(kind: MoneyScoringKind): number {
  switch (kind) {
    case "invite_friend":
      return 1;
    case "chat_messages":
      return 10;
    case "video_call_minutes":
      return 15;
    case "follow_creator":
      return 1;
    case "post_created":
      return 1;
    case "profile_likes_received":
      return 10;
    default:
      return 1;
  }
}

function readObj(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}

function parseMoneyRoot(configJson: unknown): Record<string, unknown> {
  const root = readObj(configJson);
  return readObj(root.money);
}

export function hydrateMoneyScoringCards(configJson: unknown): MoneyScoringCardState[] {
  const m = parseMoneyRoot(configJson);
  const rules = Array.isArray(m.scoringRules) ? m.scoringRules : [];
  return ALL_MONEY_SCORING_KINDS.map((kind) => {
    const hit = rules.find(
      (r) => r && typeof r === "object" && (r as { kind?: string }).kind === kind,
    ) as Record<string, unknown> | undefined;
    const threshold = Number(hit?.threshold);
    const points = Number(hit?.points);
    const mpd = Number((hit as { maxPointsPerDay?: unknown } | undefined)?.maxPointsPerDay);
    const maxPointsPerDay =
      Number.isFinite(mpd) && mpd >= 0 ? Math.min(1_000_000, Math.floor(mpd)) : 0;
    return {
      kind,
      stableId: typeof hit?.id === "string" && hit.id.trim() ? hit.id.trim() : kind,
      enabled: hit ? hit.enabled !== false : false,
      threshold:
        Number.isFinite(threshold) && threshold >= 1 ? Math.floor(threshold) : defaultThreshold(kind),
      points: Number.isFinite(points) && points >= 0 ? Math.floor(points) : 10,
      maxPointsPerDay,
    };
  });
}

import type { EdgeMoneyColorScheme } from "@/lib/edge-money-public";

const VALID_SCHEMES: EdgeMoneyColorScheme[] = ["default", "gold", "emerald", "rose", "violet", "cyan"];

export function hydrateMoneyHeadlineMedia(configJson: unknown): {
  headline: string;
  mediaUrl: string;
  colorScheme: EdgeMoneyColorScheme;
} {
  const m = parseMoneyRoot(configJson);
  const headline = typeof m.headline === "string" ? m.headline.trim().slice(0, 500) : "";
  const mediaUrl =
    typeof m.mediaUrl === "string" && m.mediaUrl.trim() ? m.mediaUrl.trim().slice(0, 2048) : "";
  const rawScheme = typeof m.colorScheme === "string" ? m.colorScheme.trim() : "";
  const colorScheme: EdgeMoneyColorScheme = VALID_SCHEMES.includes(rawScheme as EdgeMoneyColorScheme)
    ? (rawScheme as EdgeMoneyColorScheme)
    : "default";
  return { headline, mediaUrl, colorScheme };
}

export function hydrateMoneyInviteDm(configJson: unknown): { template: string; codeExpiresInHours: number } {
  const m = parseMoneyRoot(configJson);
  const dm = m.inviteDm;
  if (!dm || typeof dm !== "object" || Array.isArray(dm)) {
    return { template: "", codeExpiresInHours: 168 };
  }
  const o = dm as Record<string, unknown>;
  const template = typeof o.template === "string" ? o.template.trim().slice(0, 8000) : "";
  const h = Number(o.codeExpiresInHours);
  const codeExpiresInHours = Number.isFinite(h) ? Math.min(720, Math.max(1, Math.floor(h))) : 168;
  return { template, codeExpiresInHours };
}

/** null в PATCH — сбросить кастомный шаблон (на платформе подставится дефолт). */
export function inviteDmToMoneyPatch(
  template: string,
  codeExpiresInHours: number,
): { template: string; codeExpiresInHours: number } | null {
  const t = template.trim();
  if (!t) return null;
  return {
    template: t.slice(0, 8000),
    codeExpiresInHours: Math.min(720, Math.max(1, Math.floor(codeExpiresInHours))),
  };
}

export function hydrateMoneyTiers(configJson: unknown): MoneyTierFormRow[] {
  const m = parseMoneyRoot(configJson);
  const arr = Array.isArray(m.prizeTiers) ? m.prizeTiers : [];
  const out: MoneyTierFormRow[] = [];
  arr.forEach((raw, i) => {
    if (!raw || typeof raw !== "object") return;
    const o = raw as Record<string, unknown>;
    const fr = Math.floor(Number(o.fromRank));
    const tr = Math.floor(Number(o.toRank));
    const label = typeof o.label === "string" ? o.label.trim().slice(0, 200) : "";
    if (!Number.isFinite(fr) || !Number.isFinite(tr) || fr < 1 || tr < fr || !label) return;
    out.push({
      localId: `t_${i}_${fr}_${tr}`,
      id: typeof o.id === "string" && o.id.trim() ? o.id.trim() : `tier_${i + 1}`,
      fromRank: fr,
      toRank: tr,
      label,
    });
  });
  return out;
}

export function cardsToMoneyScoringPatch(cards: MoneyScoringCardState[]) {
  return cards
    .filter((c) => c.enabled)
    .map((c) => ({
      id: c.stableId,
      kind: c.kind,
      threshold: SINGLE_ACTION_KINDS.has(c.kind)
        ? 1
        : Math.min(1_000_000, Math.max(1, Math.floor(c.threshold))),
      points: Math.min(1_000_000, Math.max(0, Math.floor(c.points))),
      enabled: true as const,
      maxPointsPerDay: Math.min(1_000_000, Math.max(0, Math.floor(c.maxPointsPerDay ?? 0))),
    }));
}

export function tiersToMoneyPatch(tiers: MoneyTierFormRow[]) {
  return tiers.map((t) => ({
    id: t.id,
    fromRank: t.fromRank,
    toRank: t.toRank,
    label: t.label.trim().slice(0, 200),
  }));
}

export function newLocalId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
