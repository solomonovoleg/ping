import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ChevronDown, ChevronLeft, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorWithRetry } from "@/components/ui/empty";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { uploadPostMedia, uploadPostMediaImageResized } from "@/lib/posts";
import {
  createEdgeCampaignDraft,
  fetchEdgeCampaignDetail,
  fetchEdgeCampaignLifeStats,
  parseGiftTemplatesFromRow,
  patchEdgeCampaign,
  type EdgeGiftTemplateInput,
  edgeCreatorDestructiveToast,
} from "@/lib/edge-creator";
import {
  DEFAULT_LIFE_SIM_FORM,
  lifeSimFormFromConfigJson,
  lifeSimFormToPatchPayload,
  type LifeSimFormState,
} from "@/lib/edge-life-simulation-form";
import { parsePresetVerify, type PresetVerify } from "@shared/edge-task-preset-config";

const STEPS = [
  "Название",
  "Персонаж",
  "Призы",
  "Победители",
  "Подписка",
  "Задания",
  "Сроки",
  "Кто видит",
  "Готово",
] as const;

/** Подписи для настройки «кому виден пост с EDGE» (конструктор + шапка). */
const EDGE_POST_VISIBILITY_LABEL: Record<"self" | "followers" | "public", string> = {
  self: "Только себе",
  followers: "Только подписчикам",
  public: "Всем в ленте",
};
const EDGE_POST_VISIBILITY_SHORT: Record<"self" | "followers" | "public", string> = {
  self: "Только вы",
  followers: "Подписчики",
  public: "Все в ленте",
};

function isoToDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type TaskVerifyUi = PresetVerify["type"];

type TaskRow = {
  localId: string;
  /** Стабильный ключ для API (`game_0` …); после сохранения не меняем. */
  key: string;
  label: string;
  points: number;
  penalty: number;
  deadlineDays: number;
  /** Куда пойдёт XP (совпадает с EDGE `scoreTarget`). */
  scoreTarget: "primary" | "secondary";
  verifyType: TaskVerifyUi;
  verifyPostId: string;
  verifyMinCount: number;
  verifyMinLevel: number;
  verifyMinXp: number;
  verifyMinDays: number;
};

function verifyFieldsFromParsed(v: PresetVerify): Pick<
  TaskRow,
  "verifyType" | "verifyPostId" | "verifyMinCount" | "verifyMinLevel" | "verifyMinXp" | "verifyMinDays"
> {
  const base = {
    verifyType: v.type,
    verifyPostId: "",
    verifyMinCount: 1,
    verifyMinLevel: 1,
    verifyMinXp: 0,
    verifyMinDays: 1,
  };
  if (v.type === "react_post") base.verifyPostId = v.postId;
  if (v.type === "comment_post") {
    base.verifyPostId = v.postId;
    base.verifyMinCount = v.minCount;
  }
  if (v.type === "edge_min_level") base.verifyMinLevel = v.minLevel;
  if (v.type === "edge_min_xp") base.verifyMinXp = v.minXp;
  if (v.type === "edge_min_care_streak") base.verifyMinDays = v.minDays;
  if (v.type === "edge_game_login_streak") base.verifyMinDays = v.minDays;
  if (
    v.type === "edge_game_daily_taps" ||
    v.type === "edge_game_daily_feeds" ||
    v.type === "edge_game_daily_play" ||
    v.type === "edge_game_daily_toilet" ||
    v.type === "edge_game_daily_calm" ||
    v.type === "edge_game_daily_pet"
  ) {
    base.verifyMinCount = v.minCount;
  }
  if (
    v.type === "ping_invited_users" ||
    v.type === "ping_posts_published" ||
    v.type === "ping_comments_count" ||
    v.type === "ping_reactions_count"
  ) {
    base.verifyMinCount = v.minCount;
  }
  return base;
}

function rowToVerifyPayload(r: TaskRow): Record<string, unknown> {
  switch (r.verifyType) {
    case "honor":
      return { type: "honor" };
    case "follow_creator":
      return { type: "follow_creator" };
    case "react_post":
      return { type: "react_post", postId: r.verifyPostId.trim() };
    case "comment_post":
      return {
        type: "comment_post",
        postId: r.verifyPostId.trim(),
        minCount: Math.max(1, Math.floor(r.verifyMinCount)),
      };
    case "edge_min_level":
      return { type: "edge_min_level", minLevel: Math.max(1, Math.floor(r.verifyMinLevel)) };
    case "edge_min_xp":
      return { type: "edge_min_xp", minXp: Math.max(0, Math.floor(r.verifyMinXp)) };
    case "edge_min_care_streak":
      return { type: "edge_min_care_streak", minDays: Math.max(1, Math.floor(r.verifyMinDays)) };
    case "edge_game_login_streak":
      return { type: "edge_game_login_streak", minDays: Math.max(1, Math.floor(r.verifyMinDays)) };
    case "edge_game_daily_taps":
      return { type: "edge_game_daily_taps", minCount: Math.max(1, Math.floor(r.verifyMinCount)) };
    case "edge_game_daily_feeds":
      return { type: "edge_game_daily_feeds", minCount: Math.max(1, Math.floor(r.verifyMinCount)) };
    case "edge_game_daily_play":
      return { type: "edge_game_daily_play", minCount: Math.max(1, Math.floor(r.verifyMinCount)) };
    case "edge_game_daily_toilet":
      return { type: "edge_game_daily_toilet", minCount: Math.max(1, Math.floor(r.verifyMinCount)) };
    case "edge_game_daily_calm":
      return { type: "edge_game_daily_calm", minCount: Math.max(1, Math.floor(r.verifyMinCount)) };
    case "edge_game_daily_pet":
      return { type: "edge_game_daily_pet", minCount: Math.max(1, Math.floor(r.verifyMinCount)) };
    case "ping_invited_users":
      return { type: "ping_invited_users", minCount: Math.max(1, Math.floor(r.verifyMinCount)) };
    case "ping_posts_published":
      return { type: "ping_posts_published", minCount: Math.max(1, Math.floor(r.verifyMinCount)) };
    case "ping_profile_complete":
      return { type: "ping_profile_complete" };
    case "ping_comments_count":
      return { type: "ping_comments_count", minCount: Math.max(1, Math.floor(r.verifyMinCount)) };
    case "ping_reactions_count":
      return { type: "ping_reactions_count", minCount: Math.max(1, Math.floor(r.verifyMinCount)) };
    default:
      return { type: "honor" };
  }
}

function newLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type TaskScope = "game" | "global" | "commercial";

type TaskBlueprint = {
  verifyType: TaskVerifyUi;
  optionLabel: string;
  defaultLabel: string;
  help: string;
};

/** Полный каталог скриптов (игра = EDGE, глобальные = вся платформа PING). */
const ALL_TASK_BLUEPRINTS: TaskBlueprint[] = [
  {
    verifyType: "edge_game_login_streak",
    optionLabel: "Скрипт: заход в игру дней подряд",
    defaultLabel: "Заходи в EDGE несколько дней подряд",
    help: "Счётчик серии дней, когда пользователь открывал компаньон (UTC). Хранится в состоянии персонажа.",
  },
  {
    verifyType: "edge_game_daily_taps",
    optionLabel: "Скрипт: тапы по персонажу за день",
    defaultLabel: "Тапни по питомцу столько раз за день",
    help: "Счётчик тапов за календарный день (UTC), кнопка «Тап» в компаньоне.",
  },
  {
    verifyType: "edge_game_daily_feeds",
    optionLabel: "Скрипт: кормления за день",
    defaultLabel: "Покорми питомца столько раз за день",
    help: "Сколько раз за сегодня нажали «Покормить».",
  },
  {
    verifyType: "edge_game_daily_play",
    optionLabel: "Скрипт: «Поиграть» за день",
    defaultLabel: "Поиграй с питомцем столько раз за день",
    help: "Действие «Поиграть» в компаньоне, за UTC-день.",
  },
  {
    verifyType: "edge_game_daily_toilet",
    optionLabel: "Скрипт: «В туалет» за день",
    defaultLabel: "Своди питомца в туалет столько раз за день",
    help: "Отдельная кнопка ухода; счётчик за день.",
  },
  {
    verifyType: "edge_game_daily_calm",
    optionLabel: "Скрипт: «Успокоить» за день",
    defaultLabel: "Успокой питомца столько раз за день",
    help: "Действие «Успокоить» (отдельно от «Погладить»).",
  },
  {
    verifyType: "edge_game_daily_pet",
    optionLabel: "Скрипт: «Погладить» за день",
    defaultLabel: "Поглади питомца столько раз за день",
    help: "Ласка / поглаживание, счётчик за UTC-день.",
  },
  {
    verifyType: "edge_min_level",
    optionLabel: "Мин. уровень персонажа",
    defaultLabel: "Достигни уровня персонажа в кампании",
    help: "Текущий уровень персонажа в этой кампании EDGE.",
  },
  {
    verifyType: "edge_min_xp",
    optionLabel: "Мин. XP персонажа",
    defaultLabel: "Набери XP персонажа в кампании",
    help: "Суммарный XP персонажа в кампании.",
  },
  {
    verifyType: "edge_min_care_streak",
    optionLabel: "Серия заботы (кормление, дни)",
    defaultLabel: "Ухаживай за питомцем несколько дней подряд",
    help: "Care streak по кормлениям (как раньше), отдельно от «заходов в игру».",
  },
  {
    verifyType: "ping_invited_users",
    optionLabel: "Скрипт: приглашённые в PING",
    defaultLabel: "Пригласи друзей по своей реферальной ссылке",
    help: "Число пользователей с invitedById = этот пользователь (реферальная регистрация).",
  },
  {
    verifyType: "ping_posts_published",
    optionLabel: "Скрипт: опубликованные посты",
    defaultLabel: "Опубликуй посты в ленту",
    help: "Считает нечерновые посты автора во всём PING.",
  },
  {
    verifyType: "ping_profile_complete",
    optionLabel: "Скрипт: профиль заполнен",
    defaultLabel: "Заполни профиль: дата рождения, пол, аватар",
    help: "Проверка поля birthDate, gender и avatarUrl в профиле.",
  },
  {
    verifyType: "ping_comments_count",
    optionLabel: "Скрипт: комментарии к постам (весь PING)",
    defaultLabel: "Оставь комментарии к постам",
    help: "Общее число комментариев пользователя по всем постам.",
  },
  {
    verifyType: "ping_reactions_count",
    optionLabel: "Скрипт: лайки/реакции (весь PING)",
    defaultLabel: "Поставь реакции на посты",
    help: "Число записей в post_reactions для пользователя (разные посты).",
  },
  {
    verifyType: "follow_creator",
    optionLabel: "Подписка на автора кампании",
    defaultLabel: "Подпишись на автора кампании",
    help: "Подписка на создателя этой EDGE-кампании.",
  },
  {
    verifyType: "react_post",
    optionLabel: "Реакция на пост кампании",
    defaultLabel: "Поставь реакцию на пост кампании",
    help: "Пост с тем же edgeId.",
  },
  {
    verifyType: "comment_post",
    optionLabel: "Комментарии к посту кампании",
    defaultLabel: "Оставь комментарии к посту кампании",
    help: "Пост с тем же edgeId, минимум комментариев.",
  },
  {
    verifyType: "honor",
    optionLabel: "Без автопроверки",
    defaultLabel: "",
    help: "Только текст; сервер не проверяет факт. Для призов используйте скрипты выше.",
  },
];

function isGameScopeType(t: TaskVerifyUi): boolean {
  return (
    t === "honor" ||
    t.startsWith("edge_game_") ||
    t === "edge_min_level" ||
    t === "edge_min_xp" ||
    t === "edge_min_care_streak"
  );
}

function isGlobalScopeType(t: TaskVerifyUi): boolean {
  return (
    t === "honor" ||
    t.startsWith("ping_") ||
    t === "follow_creator" ||
    t === "react_post" ||
    t === "comment_post"
  );
}

function blueprintsForScope(scope: TaskScope): TaskBlueprint[] {
  if (scope === "game") return ALL_TASK_BLUEPRINTS.filter((b) => isGameScopeType(b.verifyType));
  return ALL_TASK_BLUEPRINTS.filter((b) => isGlobalScopeType(b.verifyType));
}

function blueprintMeta(t: TaskVerifyUi): TaskBlueprint {
  return ALL_TASK_BLUEPRINTS.find((b) => b.verifyType === t) ?? ALL_TASK_BLUEPRINTS[ALL_TASK_BLUEPRINTS.length - 1]!;
}

function selectOptionsForRow(scope: TaskScope, rowType: TaskVerifyUi): TaskBlueprint[] {
  const base = blueprintsForScope(scope);
  if (base.some((b) => b.verifyType === rowType)) return base;
  const extra = ALL_TASK_BLUEPRINTS.find((b) => b.verifyType === rowType);
  return extra ? [extra, ...base] : base;
}

function emptyTaskForScope(scope: TaskScope): TaskRow {
  const list = blueprintsForScope(scope);
  const b = list[0] ?? blueprintMeta("honor");
  const v = parsePresetVerify({ type: b.verifyType });
  return {
    localId: newLocalId(),
    key: "",
    label: b.defaultLabel,
    points: 10,
    penalty: 0,
    deadlineDays: 7,
    scoreTarget: scope === "game" ? "primary" : "secondary",
    ...verifyFieldsFromParsed(v),
  };
}

function needsVerifyMinDaysField(t: TaskVerifyUi): boolean {
  return t === "edge_min_care_streak" || t === "edge_game_login_streak";
}

function needsVerifyMinCountField(t: TaskVerifyUi): boolean {
  if (t === "ping_profile_complete" || t === "honor" || t === "follow_creator" || t === "react_post")
    return false;
  if (t === "comment_post") return false;
  if (needsVerifyMinDaysField(t)) return false;
  if (t === "edge_min_level" || t === "edge_min_xp") return false;
  return (
    t.startsWith("edge_game_daily_") ||
    t.startsWith("ping_") ||
    false
  );
}

function minCountLabelForType(t: TaskVerifyUi): string {
  if (t.startsWith("edge_game_daily_")) return "Минимум раз за сегодня (UTC)";
  if (t === "comment_post") return "Минимум комментариев";
  return "Минимум всего";
}

function minCountHintForType(t: TaskVerifyUi): string {
  if (t.startsWith("edge_game_daily_")) return "Например: 3 = сделать действие 3 раза за текущий день.";
  if (t === "comment_post") return "Например: 2 = оставить минимум 2 комментария к посту кампании.";
  if (t === "ping_invited_users") return "Например: 5 = пригласить 5 пользователей в PING.";
  if (t === "ping_posts_published") return "Например: 2 = опубликовать 2 поста.";
  if (t === "ping_comments_count") return "Например: 10 = оставить 10 комментариев по платформе.";
  if (t === "ping_reactions_count") return "Например: 15 = поставить 15 реакций.";
  return "Чем выше значение, тем сложнее выполнить задание.";
}

function parseSearchEdgeId(search: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  try {
    return new URLSearchParams(raw).get("edgeId")?.trim() ?? "";
  } catch {
    return "";
  }
}

function readCfg(cfg: unknown): Record<string, unknown> {
  return cfg && typeof cfg === "object" && !Array.isArray(cfg) ? (cfg as Record<string, unknown>) : {};
}

function readTasks(raw: unknown, scope: "game" | "global" | "commercial"): TaskRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x, idx) => {
    if (!x || typeof x !== "object") return emptyTaskForScope(scope);
    const o = x as Record<string, unknown>;
    let key = typeof o.key === "string" ? o.key.trim() : "";
    if (!key) key = `${scope}_${idx}`;
    const legacy = /^task_(\d+)$/.exec(key);
    if (legacy) key = `${scope}_${legacy[1]}`;
    const v = parsePresetVerify(o.verify);
    const stRaw = typeof o.scoreTarget === "string" ? o.scoreTarget.trim().toLowerCase() : "";
    const fallbackTarget = scope === "game" ? "primary" : "secondary";
    const scoreTarget: "primary" | "secondary" =
      stRaw === "primary" || stRaw === "secondary" ? stRaw : fallbackTarget;
    return {
      localId: newLocalId(),
      key,
      label: typeof o.label === "string" ? o.label : "",
      points: typeof o.points === "number" ? o.points : 10,
      penalty: typeof o.penalty === "number" ? o.penalty : 0,
      deadlineDays: typeof o.deadlineDays === "number" ? o.deadlineDays : 7,
      scoreTarget,
      ...verifyFieldsFromParsed(v),
    };
  });
}

function serializeTasks(rows: TaskRow[], scope: "game" | "global" | "commercial"): unknown[] {
  return rows
    .filter((r) => r.label.trim())
    .map((r, i) => ({
      key: (r.key && r.key.trim()) || `${scope}_${i}`,
      label: r.label.trim(),
      points: r.points,
      penalty: r.penalty,
      deadlineDays: r.deadlineDays,
      scoreTarget: r.scoreTarget,
      verify: rowToVerifyPayload(r),
    }));
}

export default function BoardEdgeNew() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const qc = useQueryClient();
  const edgeIdParam = useMemo(() => parseSearchEdgeId(search), [search]);

  const [step, setStep] = useState(0);
  const [campaignTitle, setCampaignTitle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [gifts, setGifts] = useState<EdgeGiftTemplateInput[]>([
    { title: "Главный приз", quantity: 1, winnerDm: { enabled: false, text: "", mediaUrl: null } },
  ]);
  const [prizePool, setPrizePool] = useState<"all" | "top">("all");
  const [prizeMethod, setPrizeMethod] = useState<"random" | "first">("random");
  const [prizeTopN, setPrizeTopN] = useState(50);
  const [prizeRankingKind, setPrizeRankingKind] = useState<"primary" | "secondary">("primary");
  const [followRewardXp, setFollowRewardXp] = useState(false);
  const [followDmEnabled, setFollowDmEnabled] = useState(false);
  const [followDmText, setFollowDmText] = useState("");
  const [followDmMediaUrl, setFollowDmMediaUrl] = useState("");
  /** Шаблон ЛС с кодами для заданий `ping_invited_users` (плейсхолдеры {{codes}}, {{count}}). */
  const [pingInviteTemplate, setPingInviteTemplate] = useState("");
  const [pingInviteHours, setPingInviteHours] = useState(168);
  const [pingInviteIssueMode, setPingInviteIssueMode] = useState<
    "batch_min_count" | "single_per_request" | "one_multi_use"
  >("batch_min_count");
  const [pingInviteMultiUseMax, setPingInviteMultiUseMax] = useState(50);
  const [tasksGame, setTasksGame] = useState<TaskRow[]>([]);
  const [tasksGlobal, setTasksGlobal] = useState<TaskRow[]>([]);
  const [tasksCommercial, setTasksCommercial] = useState<TaskRow[]>([]);
  const [drawSummary, setDrawSummary] = useState("");
  const [resetSummary, setResetSummary] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [displayAudience, setDisplayAudience] = useState<"self" | "followers" | "public">("public");
  const [leaderboardPrimaryEnabled, setLeaderboardPrimaryEnabled] = useState(true);
  const [leaderboardSecondaryEnabled, setLeaderboardSecondaryEnabled] = useState(false);
  const [lifeSim, setLifeSim] = useState<LifeSimFormState>(DEFAULT_LIFE_SIM_FORM);

  const hydratedFor = useRef("");
  const characterFileInputRef = useRef<HTMLInputElement>(null);
  const [characterUploading, setCharacterUploading] = useState(false);

  const detailQ = useQuery({
    queryKey: ["edge", "creator", "detail", edgeIdParam],
    queryFn: () => fetchEdgeCampaignDetail(edgeIdParam),
    enabled: Boolean(edgeIdParam),
    retry: 1,
  });

  const lifeStatsQ = useQuery({
    queryKey: ["edge", "creator", "life-stats", edgeIdParam],
    queryFn: () => fetchEdgeCampaignLifeStats(edgeIdParam!),
    enabled: Boolean(edgeIdParam) && step === 8,
    staleTime: 20_000,
  });

  useEffect(() => {
    const d = detailQ.data;
    if (!d || hydratedFor.current === d.edgeId) return;
    hydratedFor.current = d.edgeId;
    setCampaignTitle(d.title);
    const parsedGifts = parseGiftTemplatesFromRow(d.giftsJson);
    setGifts(
      parsedGifts.length
        ? parsedGifts
        : [{ title: "Главный приз", quantity: 1, winnerDm: { enabled: false, text: "", mediaUrl: null } }],
    );
    setFollowRewardXp(d.followRewardEnabled);
    setLeaderboardPrimaryEnabled(d.leaderboardPrimaryEnabled ?? true);
    setLeaderboardSecondaryEnabled(d.leaderboardSecondaryEnabled ?? false);
    const root = readCfg(d.configJson);
    const comp = readCfg(root.companion);
    const ch = readCfg(comp.character);
    setDisplayName(typeof ch.displayName === "string" ? ch.displayName : "");
    setAssetUrl(typeof ch.assetUrl === "string" ? ch.assetUrl : "");
    const intro = comp.infoArticle;
    if (intro && typeof intro === "object") {
      const blocks = (intro as { blocks?: unknown }).blocks;
      const first =
        Array.isArray(blocks) && blocks[0] && typeof blocks[0] === "object"
          ? (blocks[0] as { type?: string; text?: string })
          : null;
      if (first?.type === "paragraph" && typeof first.text === "string") {
        /* optional — можно вывести в UI позже */
      }
    }
    const pr = readCfg(root.prizeRules);
    if (pr.pool === "top" || pr.pool === "all") setPrizePool(pr.pool as "all" | "top");
    if (pr.method === "first" || pr.method === "random") setPrizeMethod(pr.method as "random" | "first");
    const ptn = pr.topN;
    if (typeof ptn === "number" && Number.isFinite(ptn)) {
      setPrizeTopN(Math.min(5000, Math.max(1, Math.floor(ptn))));
    }
    const rk = pr.rankingKind ?? pr.rankingScope;
    setPrizeRankingKind(rk === "secondary" ? "secondary" : "primary");
    const sch = readCfg(root.schedule);
    setDrawSummary(typeof sch.drawSummary === "string" ? sch.drawSummary : "");
    setResetSummary(typeof sch.leaderboardResetSummary === "string" ? sch.leaderboardResetSummary : "");
    const ea = sch.endsAt;
    if (typeof ea === "string" && ea) {
      setEndsAt(ea.slice(0, 10));
    }
    const fr = readCfg(root.followRewardDm);
    setFollowDmEnabled(fr.enabled === true);
    setFollowDmText(typeof fr.text === "string" ? fr.text : "");
    setFollowDmMediaUrl(typeof fr.mediaUrl === "string" ? fr.mediaUrl : "");
    const pid = readCfg(root.pingInviteDm);
    setPingInviteTemplate(typeof pid.template === "string" ? pid.template : "");
    const pih = pid.codeExpiresInHours;
    setPingInviteHours(
      typeof pih === "number" && Number.isFinite(pih)
        ? Math.min(720, Math.max(1, Math.floor(pih)))
        : 168,
    );
    const mode = pid.inviteIssueMode;
    if (mode === "single_per_request" || mode === "one_multi_use" || mode === "batch_min_count") {
      setPingInviteIssueMode(mode);
    } else {
      setPingInviteIssueMode("batch_min_count");
    }
    const mum = pid.multiUseRegistrations;
    setPingInviteMultiUseMax(
      typeof mum === "number" && Number.isFinite(mum)
        ? Math.min(10000, Math.max(2, Math.floor(mum)))
        : 50,
    );
    const tp = readCfg(root.taskPresets);
    setTasksGame(readTasks(tp.game, "game"));
    setTasksGlobal(readTasks(tp.global, "global"));
    setTasksCommercial(readTasks(tp.commercial, "commercial"));
    const daRaw = readCfg(d.configJson).displayAudience;
    if (daRaw === "self" || daRaw === "followers" || daRaw === "public") {
      setDisplayAudience(daRaw);
    } else {
      setDisplayAudience("public");
    }
    setLifeSim(lifeSimFormFromConfigJson(d.configJson));
    const sk = `edgeWizard:${d.edgeId}:step`;
    const saved = sessionStorage.getItem(sk);
    const n = saved ? Number.parseInt(saved, 10) : NaN;
    setStep(Number.isFinite(n) && n >= 1 && n <= STEPS.length - 1 ? n : 1);
  }, [detailQ.data]);

  useEffect(() => {
    if (!edgeIdParam) return;
    sessionStorage.setItem(`edgeWizard:${edgeIdParam}:step`, String(step));
  }, [edgeIdParam, step]);

  const resumePrimaryMut = useMutation({
    mutationFn: async () => {
      if (!edgeIdParam) return;
      await patchEdgeCampaign(edgeIdParam, {
        leaderboardPrimaryPrizeDrawRankingFreezeLifted: true,
        leaderboardPrimaryFrozenAtClear: true,
      });
      void qc.invalidateQueries({ queryKey: ["edge", "my-campaigns"] });
      void qc.invalidateQueries({ queryKey: ["edge", "creator", "detail", edgeIdParam] });
    },
    onSuccess: () => toast({ title: "Сохранено", description: "Основной рейтинг снова начисляет очки." }),
    onError: (e) => toast({ ...edgeCreatorDestructiveToast(e), variant: "destructive" }),
  });

  const resumeSecondaryMut = useMutation({
    mutationFn: async () => {
      if (!edgeIdParam) return;
      await patchEdgeCampaign(edgeIdParam, {
        leaderboardSecondaryPrizeDrawRankingFreezeLifted: true,
        leaderboardSecondaryFrozenAtClear: true,
      });
      void qc.invalidateQueries({ queryKey: ["edge", "my-campaigns"] });
      void qc.invalidateQueries({ queryKey: ["edge", "creator", "detail", edgeIdParam] });
    },
    onSuccess: () =>
      toast({
        title: "Сохранено",
        description: "Дополнительный рейтинг снова начисляет очки (снята пауза по дате приза и ручная заморозка).",
      }),
    onError: (e) => toast({ ...edgeCreatorDestructiveToast(e), variant: "destructive" }),
  });

  const createMut = useMutation({
    mutationFn: () => createEdgeCampaignDraft({ title: campaignTitle || "Новая кампания EDGE" }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["edge", "my-campaigns"] });
      toast({ title: "Черновик создан" });
      sessionStorage.setItem(`edgeWizard:${data.edgeId}:step`, "1");
      setLocation(`/board/edge/new?edgeId=${encodeURIComponent(data.edgeId)}`);
    },
    onError: (e) => {
      toast({ ...edgeCreatorDestructiveToast(e), variant: "destructive" });
    },
  });

  const savePatch = useCallback(
    async (partial: Parameters<typeof patchEdgeCampaign>[1]) => {
      if (!edgeIdParam) return;
      await patchEdgeCampaign(edgeIdParam, partial);
      void qc.invalidateQueries({ queryKey: ["edge", "my-campaigns"] });
      void qc.invalidateQueries({ queryKey: ["edge", "creator", "detail", edgeIdParam] });
      void qc.invalidateQueries({ queryKey: ["edge", "creator", "life-stats", edgeIdParam] });
    },
    [edgeIdParam, qc],
  );

  const onUploadCharacter = async (file: File | null, inputEl: HTMLInputElement | null) => {
    if (!file) return;
    const looksImage =
      file.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|hei[cf])$/i.test(file.name || "");
    if (!looksImage) {
      toast({ title: "Нужен файл изображения (PNG, JPEG, WebP или HEIC)", variant: "destructive" });
      if (inputEl) inputEl.value = "";
      return;
    }
    setCharacterUploading(true);
    try {
      const url = await uploadPostMediaImageResized(file, { preserveTransparency: true });
      setAssetUrl(url);
      if (edgeIdParam) {
        await savePatch({ companionCharacter: { assetUrl: url, displayName: displayName.trim() } });
        toast({ title: "Картинка сохранена" });
      }
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Загрузка не удалась",
        variant: "destructive",
      });
    } finally {
      setCharacterUploading(false);
      if (inputEl) inputEl.value = "";
    }
  };

  const clearCharacterImage = useCallback(async () => {
    setAssetUrl("");
    if (characterFileInputRef.current) characterFileInputRef.current.value = "";
    if (!edgeIdParam) return;
    try {
      await savePatch({ companionCharacter: { assetUrl: "", displayName: displayName.trim() } });
      toast({ title: "Картинка убрана" });
    } catch (e) {
      toast({ ...edgeCreatorDestructiveToast(e), variant: "destructive" });
    }
  }, [edgeIdParam, displayName, savePatch, toast]);

  const goNext = async () => {
    if (!edgeIdParam && step === 0) {
      createMut.mutate();
      return;
    }
    if (!edgeIdParam) return;
    try {
      if (step === 1) {
        await savePatch({
          companionCharacter: {
            assetUrl: assetUrl.trim(),
            displayName: displayName.trim(),
          },
          companionLifeSimulation: lifeSimFormToPatchPayload(lifeSim),
        });
      }
      if (step === 2) {
        await savePatch({
          giftsTemplates: gifts
            .filter((g) => g.title.trim())
            .map((g) => ({
              ...g,
              drawAt: g.drawAt === null ? null : g.drawAt?.trim() ? g.drawAt : undefined,
              leaderboardScopes: g.leaderboardScopes?.length ? g.leaderboardScopes : undefined,
              winnerDm: g.winnerDm ?? { enabled: false, text: "", mediaUrl: null },
            })),
        });
      }
      if (step === 3) {
        await savePatch({
          prizeRules: {
            pool: prizePool,
            method: prizeMethod,
            topN: prizeTopN,
            rankingKind: prizeRankingKind,
          },
        });
      }
      if (step === 4) {
        await savePatch({
          followRewardEnabled: followRewardXp,
          followRewardDm: {
            enabled: followDmEnabled,
            text: followDmText.trim(),
            mediaUrl: followDmMediaUrl.trim() || null,
          },
          pingInviteDm: {
            template: pingInviteTemplate.trim(),
            codeExpiresInHours: pingInviteHours,
            inviteIssueMode: pingInviteIssueMode,
            ...(pingInviteIssueMode === "one_multi_use"
              ? { multiUseRegistrations: pingInviteMultiUseMax }
              : {}),
          },
        });
      }
      if (step === 5) {
        await savePatch({
          taskPresets: {
            game: serializeTasks(tasksGame, "game"),
            global: serializeTasks(tasksGlobal, "global"),
            commercial: serializeTasks(tasksCommercial, "commercial"),
          },
        });
      }
      if (step === 6) {
        await savePatch({
          schedule: {
            drawSummary: drawSummary.trim(),
            leaderboardResetSummary: resetSummary.trim(),
            endsAt: endsAt.trim() ? new Date(`${endsAt}T23:59:59`).toISOString() : null,
          },
        });
      }
      if (step === 7) {
        await savePatch({
          displayAudience,
          leaderboardPrimaryEnabled,
          leaderboardSecondaryEnabled,
        });
      }
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
      toast({ title: "Сохранено" });
    } catch (e) {
      toast({ ...edgeCreatorDestructiveToast(e), variant: "destructive" });
    }
  };

  const publishMut = useMutation({
    mutationFn: () => savePatch({ status: "published" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["edge", "my-campaigns"] });
      toast({
        title: "Кампания опубликована",
        description:
          "Сейчас откроется создание поста: опубликуйте его — тогда игра появится в профиле и ленте.",
      });
      if (edgeIdParam) {
        setLocation(`/create-post?edgeId=${encodeURIComponent(edgeIdParam)}`);
      } else {
        setLocation("/board/edge/manage");
      }
    },
    onError: (e) => {
      toast({ ...edgeCreatorDestructiveToast(e), variant: "destructive" });
    },
  });

  const isBusy =
    createMut.isPending || detailQ.isLoading || publishMut.isPending || characterUploading;

  if (edgeIdParam && detailQ.isLoading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <header className="glass sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 uix-content-x pt-6 pb-4">
          <TapScaleButton
            type="button"
            onClick={() => setLocation("/board/edge")}
            haptic
            subtle
            className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 -ml-2 hover:bg-secondary"
            aria-label="Назад"
          >
            <ChevronLeft className="h-6 w-6" />
          </TapScaleButton>
          <h1 className="uix-text-title">Конструктор EDGE</h1>
        </header>
        <div className="uix-content-x flex flex-1 items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Загрузка" />
        </div>
      </div>
    );
  }

  if (edgeIdParam && detailQ.isError) {
    return (
      <div className="flex h-full flex-col bg-background">
        <header className="glass sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 uix-content-x pt-6 pb-4">
          <TapScaleButton
            type="button"
            onClick={() => setLocation("/board/edge")}
            haptic
            subtle
            className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 -ml-2 hover:bg-secondary"
            aria-label="Назад"
          >
            <ChevronLeft className="h-6 w-6" />
          </TapScaleButton>
          <h1 className="uix-text-title">Новый EDGE</h1>
        </header>
        <div className="uix-content-x flex-1 py-6">
          <ErrorWithRetry
            title="Не удалось загрузить кампанию"
            description={detailQ.error instanceof Error ? detailQ.error.message : "Повторите"}
            onRetry={() => void detailQ.refetch()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full max-w-full min-w-0 flex-col overflow-hidden bg-background">
      <header className="glass sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 uix-content-x pt-6 pb-4">
        <TapScaleButton
          type="button"
          onClick={() => setLocation("/board/edge")}
          haptic
          subtle
          className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 -ml-2 hover:bg-secondary"
          aria-label="Назад"
        >
          <ChevronLeft className="h-6 w-6" />
        </TapScaleButton>
        <h1 className="uix-text-title min-w-0 flex-1 truncate">Конструктор EDGE</h1>
      </header>

      <div className="border-b border-border/30 uix-content-x py-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="uix-text-caption text-muted-foreground">
            Шаг {step + 1}/{STEPS.length}: {STEPS[step]}
          </p>
          {edgeIdParam ? (
            <span
              className="inline-flex max-w-full items-center rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-foreground"
              title={`Видимость поста с EDGE в ленте и профиле: ${EDGE_POST_VISIBILITY_LABEL[displayAudience]}`}
            >
              Пост с EDGE: {EDGE_POST_VISIBILITY_SHORT[displayAudience]}
            </span>
          ) : null}
        </div>
        {edgeIdParam ? (
          <div className="mt-1 space-y-0.5">
            <p className="font-mono text-[10px] text-muted-foreground break-all">edgeId: {edgeIdParam}</p>
            {detailQ.isLoading && !detailQ.data ? (
              <p className="uix-text-caption text-muted-foreground">Видимость поста с EDGE: загрузка…</p>
            ) : (
              <p className="uix-text-caption text-foreground">
                <span className="text-muted-foreground">Сейчас в настройках: </span>
                <span className="font-medium">{EDGE_POST_VISIBILITY_LABEL[displayAudience]}</span>
                <span className="text-muted-foreground">
                  {step === 7
                    ? " — после «Далее» настройка сохранится на сервер; также можно сменить из меню поста ⋯"
                    : ` — сменить: шаг «${STEPS[7]}» или меню поста ⋯ после публикации`}
                </span>
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto uix-content-x py-4 pb-[calc(var(--uix-nav-bottom)+var(--uix-space-6))]">
        {!edgeIdParam && step === 0 ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="camp-title">Название кампании (внутреннее)</Label>
              <Input
                id="camp-title"
                value={campaignTitle}
                onChange={(e) => setCampaignTitle(e.target.value)}
                placeholder="Например, Весенний розыгрыш"
                className="mt-1.5"
                maxLength={200}
              />
            </div>
            <p className="uix-text-caption text-muted-foreground leading-snug">
              Тип: <strong>Персонаж</strong>. Нужна игра на деньги и рейтинг без тамагочи —{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => setLocation("/board/edge/new-money")}
              >
                EDGE MONEY
              </button>
              .
            </p>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="disp-name">Как персонаж представлен людям</Label>
              <Input
                id="disp-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Имя героя"
                className="mt-1.5"
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="edge-character-file">PNG на прозрачном фоне</Label>
              <input
                id="edge-character-file"
                ref={characterFileInputRef}
                type="file"
                accept="image/png,image/webp,image/jpeg"
                className="sr-only"
                onChange={(e) => void onUploadCharacter(e.target.files?.[0] ?? null, e.target)}
              />
              <div className="mt-1.5 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <TapScaleButton
                    type="button"
                    subtle
                    haptic
                    disabled={characterUploading}
                    className="inline-flex min-h-[var(--uix-touch-min)] items-center gap-2 rounded-xl border border-border px-3 py-2 uix-text-caption"
                    aria-label="Выбрать файл изображения персонажа"
                    onClick={() => characterFileInputRef.current?.click()}
                  >
                    {characterUploading ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : (
                      <ImagePlus className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    {characterUploading ? "Загрузка…" : "Выбрать файл с устройства"}
                  </TapScaleButton>
                  {assetUrl ? (
                    <TapScaleButton
                      type="button"
                      subtle
                      haptic
                      disabled={characterUploading}
                      className="min-h-[var(--uix-touch-min)] uix-text-caption text-muted-foreground"
                      onClick={() => void clearCharacterImage()}
                    >
                      Убрать
                    </TapScaleButton>
                  ) : null}
                </div>
                {assetUrl ? (
                  <div className="relative overflow-hidden rounded-xl border border-border/60 bg-[repeating-conic-gradient(#2a2a2e_0%_25%,#1a1a1e_0%_50%)_50%_/_16px_16px] p-2 dark:bg-[repeating-conic-gradient(#2a2a32_0%_25%,#18181c_0%_50%)_50%_/_16px_16px]">
                    <img
                      src={assetUrl}
                      alt="Предпросмотр персонажа"
                      className="mx-auto max-h-40 w-auto max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <p className="uix-text-caption text-muted-foreground">
                    Прозрачный фон PNG сохраняется при загрузке и при уменьшении большого файла. На сервер файл уходит сразу
                    после выбора.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-2 space-y-4 rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Рейтинг жизни</p>
                  <p className="mt-0.5 uix-text-caption text-muted-foreground leading-snug">
                    Запросы по очереди (покормить, туалет, игра, успокоить), окно «вовремя», бонусы и штрафы. Игроки
                    видят это в компаньоне рядом с персонажем.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Label htmlFor="edge-life-sim-enabled" className="uix-text-caption text-muted-foreground">
                    Включено
                  </Label>
                  <Switch
                    id="edge-life-sim-enabled"
                    checked={lifeSim.enabled}
                    onCheckedChange={(v) => setLifeSim((s) => ({ ...s, enabled: v }))}
                    aria-label="Включить рейтинг жизни персонажа"
                  />
                </div>
              </div>
              {lifeSim.enabled ? (
                <div className="space-y-3 border-t border-border/40 pt-4">
                  <p className="text-xs font-medium text-foreground">Шкала и старт</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Минимум</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        className="tabular-nums"
                        value={lifeSim.lifeMin}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10);
                          setLifeSim((s) => ({ ...s, lifeMin: Number.isFinite(n) ? n : s.lifeMin }));
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Максимум</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        className="tabular-nums"
                        value={lifeSim.lifeMax}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10);
                          setLifeSim((s) => ({ ...s, lifeMax: Number.isFinite(n) ? n : s.lifeMax }));
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Старт для новых</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        className="tabular-nums"
                        value={lifeSim.lifeInitial}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10);
                          setLifeSim((s) => ({ ...s, lifeInitial: Number.isFinite(n) ? n : s.lifeInitial }));
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-xs font-medium text-foreground">Интервалы новых запросов (часы)</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["intervalFeed", "Покормить"] as const,
                        ["intervalToilet", "Туалет"] as const,
                        ["intervalPlay", "Поиграть"] as const,
                        ["intervalCalm", "Успокоить"] as const,
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs">{label}</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.25"
                          min={0.25}
                          className="tabular-nums"
                          value={lifeSim[key]}
                          onChange={(e) => {
                            const n = Number.parseFloat(e.target.value);
                            setLifeSim((s) => ({ ...s, [key]: Number.isFinite(n) ? n : s[key] }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-medium text-foreground">Окно и баллы</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Окно «вовремя» (ч)</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.25"
                        min={0.25}
                        className="tabular-nums"
                        value={lifeSim.responseWindowHours}
                        onChange={(e) => {
                          const n = Number.parseFloat(e.target.value);
                          setLifeSim((s) => ({
                            ...s,
                            responseWindowHours: Number.isFinite(n) ? n : s.responseWindowHours,
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Лимит очереди на тип</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={50}
                        className="tabular-nums"
                        value={lifeSim.maxQueuePerKind}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10);
                          setLifeSim((s) => ({
                            ...s,
                            maxQueuePerKind: Number.isFinite(n) ? n : s.maxQueuePerKind,
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Бонус вовремя (+ к жизни)</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        className="tabular-nums"
                        value={lifeSim.onTimeBonus}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10);
                          setLifeSim((s) => ({ ...s, onTimeBonus: Number.isFinite(n) ? n : s.onTimeBonus }));
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Бонус за действие в очереди</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        className="tabular-nums"
                        value={lifeSim.queueFulfillBonus}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10);
                          setLifeSim((s) => ({
                            ...s,
                            queueFulfillBonus: Number.isFinite(n) ? n : s.queueFulfillBonus,
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Штраф за просрочку</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        className="tabular-nums"
                        value={lifeSim.missedPenalty}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10);
                          setLifeSim((s) => ({
                            ...s,
                            missedPenalty: Number.isFinite(n) ? n : s.missedPenalty,
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Бонус «настроение макс.»</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        className="tabular-nums"
                        value={lifeSim.maxMoodBonus}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10);
                          setLifeSim((s) => ({ ...s, maxMoodBonus: Number.isFinite(n) ? n : s.maxMoodBonus }));
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="uix-text-caption text-muted-foreground border-t border-border/40 pt-3">
                  Пока выключено — у участников не копится очередь запросов и не считается отдельный рейтинг жизни.
                </p>
              )}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            {gifts.map((g, i) => (
              <div key={i} className="rounded-2xl border border-border/60 bg-card p-3 space-y-2">
                <div className="flex justify-between gap-2">
                  <Label className="text-xs">Приз {i + 1}</Label>
                  <TapScaleButton
                    type="button"
                    subtle
                    haptic
                    className="p-1 text-destructive min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]"
                    aria-label="Удалить приз"
                    onClick={() => setGifts((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </TapScaleButton>
                </div>
                <Input
                  placeholder="Название приза"
                  value={g.title}
                  onChange={(e) => {
                    const v = e.target.value;
                    setGifts((prev) => prev.map((x, j) => (j === i ? { ...x, title: v } : x)));
                  }}
                />
                <Input
                  type="number"
                  min={1}
                  max={9999}
                  placeholder="Сколько штук выдать"
                  value={g.quantity ?? ""}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    setGifts((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, quantity: Number.isFinite(n) ? n : undefined } : x)),
                    );
                  }}
                />
                <div>
                  <Label className="text-xs">Дата и время розыгрыша (по местному времени)</Label>
                  <Input
                    type="datetime-local"
                    className="mt-1"
                    value={isoToDatetimeLocalValue(g.drawAt ?? undefined)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setGifts((prev) =>
                        prev.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                drawAt: v ? new Date(v).toISOString() : undefined,
                              }
                            : x,
                        ),
                      );
                    }}
                    aria-label={`Дата розыгрыша приза ${i + 1}`}
                  />
                  <p className="mt-1 uix-text-caption text-muted-foreground leading-snug">
                    После этого момента начисление очков в отмеченные рейтинги останавливается, пока вы не нажмёте
                    «Возобновить начисление» на шаге «Кто видит».
                  </p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-foreground">Пауза рейтингов после розыгрыша</span>
                  <div className="flex flex-wrap gap-3">
                    {(["primary", "secondary"] as const).map((scope) => (
                      <label key={scope} className="flex items-center gap-2 uix-text-caption">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={g.leaderboardScopes?.includes(scope) ?? false}
                          onChange={(e) => {
                            setGifts((prev) =>
                              prev.map((x, j) => {
                                if (j !== i) return x;
                                const cur = new Set(x.leaderboardScopes ?? []);
                                if (e.target.checked) cur.add(scope);
                                else cur.delete(scope);
                                const arr = Array.from(cur) as Array<"primary" | "secondary">;
                                return { ...x, leaderboardScopes: arr.length ? arr : undefined };
                              }),
                            );
                          }}
                          aria-label={scope === "primary" ? "Пауза основного рейтинга" : "Пауза дополнительного рейтинга"}
                        />
                        {scope === "primary" ? "Основной рейтинг" : "Дополнительный"}
                      </label>
                    ))}
                  </div>
                  <p className="uix-text-caption text-muted-foreground leading-snug">
                    Если дата розыгрыша указана и галочек нет — пауза для обоих рейтингов.
                  </p>
                </div>
                <TapScaleButton
                  type="button"
                  subtle
                  haptic
                  className="inline-flex items-center gap-1 uix-text-caption"
                  onClick={async () => {
                    const inp = document.createElement("input");
                    inp.type = "file";
                    inp.accept = "image/*,video/*";
                    inp.onchange = async () => {
                      const f = inp.files?.[0];
                      if (!f) return;
                      try {
                        const isVideo = f.type.startsWith("video/");
                        const url = isVideo ? await uploadPostMedia(f) : await uploadPostMediaImageResized(f);
                        setGifts((prev) =>
                          prev.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  ...(isVideo
                                    ? { videoUrl: url, imageUrl: undefined }
                                    : { imageUrl: url, videoUrl: undefined }),
                                }
                              : x,
                          ),
                        );
                        toast({ title: "Медиа загружено" });
                      } catch (e) {
                        toast({
                          title: e instanceof Error ? e.message : "Ошибка",
                          variant: "destructive",
                        });
                      }
                    };
                    inp.click();
                  }}
                >
                  <ImagePlus className="h-4 w-4" />
                  Картинка / видео
                </TapScaleButton>
                <div className="rounded-xl border border-border/40 bg-muted/5 p-3 space-y-2">
                  <p className="text-xs font-medium text-foreground">ЛС победителю (после розыгрыша)</p>
                  <p className="uix-text-caption text-muted-foreground leading-snug">
                    Когда вы нажмёте «Подвести итоги» в списке кампаний, победителям уйдёт сообщение от вашего имени. Можно
                    использовать плейсхолдеры <code className="rounded bg-muted px-1">{"{{giftLabel}}"}</code> и{" "}
                    <code className="rounded bg-muted px-1">{"{{campaignTitle}}"}</code>.
                  </p>
                  <label className="flex items-center gap-2 uix-text-caption">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={g.winnerDm?.enabled ?? false}
                      onChange={(e) => {
                        setGifts((prev) =>
                          prev.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  winnerDm: {
                                    enabled: e.target.checked,
                                    text: x.winnerDm?.text ?? "",
                                    mediaUrl: x.winnerDm?.mediaUrl ?? null,
                                  },
                                }
                              : x,
                          ),
                        );
                      }}
                    />
                    Отправлять ЛС победителю этого приза
                  </label>
                  <Textarea
                    value={g.winnerDm?.text ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setGifts((prev) =>
                        prev.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                winnerDm: {
                                  enabled: x.winnerDm?.enabled ?? false,
                                  text: v,
                                  mediaUrl: x.winnerDm?.mediaUrl ?? null,
                                },
                              }
                            : x,
                        ),
                      );
                    }}
                    placeholder="Например: Вы выиграли {{giftLabel}}! Напишите мне в ответ, чтобы забрать приз."
                    rows={3}
                    disabled={!(g.winnerDm?.enabled ?? false)}
                    className="text-sm"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <TapScaleButton
                      type="button"
                      subtle
                      haptic
                      disabled={!(g.winnerDm?.enabled ?? false)}
                      className="inline-flex items-center gap-1 uix-text-caption"
                      onClick={() => {
                        const inp = document.createElement("input");
                        inp.type = "file";
                        inp.accept = "image/*,video/*";
                        inp.onchange = async () => {
                          const f = inp.files?.[0];
                          if (!f) return;
                          try {
                            const isVideo = f.type.startsWith("video/");
                            const url = isVideo ? await uploadPostMedia(f) : await uploadPostMediaImageResized(f);
                            setGifts((prev) =>
                              prev.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      winnerDm: {
                                        enabled: x.winnerDm?.enabled ?? true,
                                        text: x.winnerDm?.text ?? "",
                                        mediaUrl: url,
                                      },
                                    }
                                  : x,
                              ),
                            );
                            toast({ title: "Вложение для ЛС победителя загружено" });
                          } catch (e) {
                            toast({
                              title: e instanceof Error ? e.message : "Ошибка",
                              variant: "destructive",
                            });
                          }
                        };
                        inp.click();
                      }}
                    >
                      <ImagePlus className="h-4 w-4" />
                      Медиа к ЛС победителю
                    </TapScaleButton>
                    {(g.winnerDm?.mediaUrl ?? "").trim() ? (
                      <TapScaleButton
                        type="button"
                        subtle
                        haptic
                        className="uix-text-caption text-muted-foreground"
                        onClick={() =>
                          setGifts((prev) =>
                            prev.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    winnerDm: {
                                      enabled: x.winnerDm?.enabled ?? false,
                                      text: x.winnerDm?.text ?? "",
                                      mediaUrl: null,
                                    },
                                  }
                                : x,
                            ),
                          )
                        }
                      >
                        Убрать вложение
                      </TapScaleButton>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            <TapScaleButton
              type="button"
              haptic
              subtle
              className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 uix-text-caption"
              onClick={() =>
                setGifts((p) => [
                  ...p,
                  { title: "", quantity: 1, winnerDm: { enabled: false, text: "", mediaUrl: null } },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Добавить приз
            </TapScaleButton>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div>
              <Label>Пул для розыгрыша</Label>
              <select
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={prizePool}
                onChange={(e) => setPrizePool(e.target.value as "all" | "top")}
              >
                <option value="all">Все участники</option>
                <option value="top">Топ лидерборда по XP</option>
              </select>
            </div>
            {prizePool === "top" ? (
              <div>
                <Label htmlFor="prize-topn">Сколько человек в топе участвуют в розыгрыше</Label>
                <Input
                  id="prize-topn"
                  type="number"
                  min={1}
                  max={5000}
                  className="mt-1.5"
                  value={prizeTopN}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    setPrizeTopN(Number.isFinite(n) ? Math.min(5000, Math.max(1, n)) : 50);
                  }}
                />
              </div>
            ) : null}
            <div>
              <Label>По какому рейтингу строить топ</Label>
              <select
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={prizeRankingKind}
                onChange={(e) => setPrizeRankingKind(e.target.value as "primary" | "secondary")}
                disabled={prizePool !== "top"}
                aria-label="Рейтинг для топа при розыгрыше"
              >
                <option value="primary">Основной</option>
                <option value="secondary" disabled={!leaderboardSecondaryEnabled}>
                  Дополнительный{!leaderboardSecondaryEnabled ? " (включите на шаге «Кто видит»)" : ""}
                </option>
              </select>
              <p className="mt-1 uix-text-caption text-muted-foreground leading-snug">
                Для пула «все участники» порядок — по дате входа в игру; рейтинг нужен только для варианта «топ N».
              </p>
            </div>
            <div>
              <Label>Как выбирать</Label>
              <select
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={prizeMethod}
                onChange={(e) => setPrizeMethod(e.target.value as "random" | "first")}
              >
                <option value="random">Случайно среди допущенных</option>
                <option value="first">Кто раньше в порядке пула (по дате входа / рейтингу)</option>
              </select>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <p className="uix-text-caption text-muted-foreground leading-snug">
              Награда за подписку и опциональное авто-ЛС новому подписчику — настройки ниже.
            </p>
            <Collapsible>
              <CollapsibleTrigger asChild>
                <TapScaleButton
                  type="button"
                  subtle
                  haptic
                  className="flex min-h-[var(--uix-touch-min)] w-full items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/10 px-3 py-2 uix-text-caption font-medium text-foreground data-[state=open]:[&_svg]:rotate-180"
                  aria-label="Справка про авто-ЛС за подписку"
                >
                  <span>Как работает сообщение за подписку</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" aria-hidden />
                </TapScaleButton>
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden pt-2">
                <div className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2 uix-text-caption text-muted-foreground leading-snug">
                  Письмо уходит от вашего имени в личку после подписки и начисления XP за кампанию. Включите «Авто-сообщение…»,
                  введите текст и при необходимости медиа. Без галочки и текста письма не будет.
                </div>
              </CollapsibleContent>
            </Collapsible>
            <label className="flex items-center gap-2 uix-text-list-secondary">
              <input
                type="checkbox"
                checked={followRewardXp}
                onChange={(e) => setFollowRewardXp(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Награда XP за подписку на профиль автора (уже работает на платформе)
            </label>
            <label className="flex items-center gap-2 uix-text-list-secondary">
              <input
                type="checkbox"
                checked={followDmEnabled}
                onChange={(e) => setFollowDmEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Авто-сообщение в ЛС от вас подписчику сразу после подписки (текст и/или медиа)
            </label>
            <Textarea
              value={followDmText}
              onChange={(e) => setFollowDmText(e.target.value)}
              placeholder="Текст авто-ЛС новому подписчику (например: спасибо за подписку и ссылка на правила игры)"
              rows={4}
            />
            <TapScaleButton
              type="button"
              subtle
              haptic
              className="inline-flex items-center gap-2"
              onClick={() => {
                const inp = document.createElement("input");
                inp.type = "file";
                inp.accept = "image/*,video/*";
                inp.onchange = async () => {
                  const f = inp.files?.[0];
                  if (!f) return;
                  try {
                    const isVideo = f.type.startsWith("video/");
                    const url = isVideo ? await uploadPostMedia(f) : await uploadPostMediaImageResized(f);
                    setFollowDmMediaUrl(url);
                    toast({ title: "Вложение для ЛС загружено" });
                  } catch (e) {
                    toast({
                      title: e instanceof Error ? e.message : "Ошибка",
                      variant: "destructive",
                    });
                  }
                };
                inp.click();
              }}
            >
              <ImagePlus className="h-4 w-4" />
              Медиа к авто-ЛС
            </TapScaleButton>
            <div className="rounded-2xl border border-border/50 bg-muted/15 p-3 space-y-3">
              <p className="uix-text-caption font-medium text-foreground">
                ЛС с кодами для задания «пригласить в PING»
              </p>
              <p className="uix-text-caption text-muted-foreground leading-snug">
                Шаблон сообщения и режим выдачи — ниже. Плейсхолдеры:{" "}
                <code className="rounded bg-muted px-1">{"{{codes}}"}</code>,{" "}
                <code className="rounded bg-muted px-1">{"{{count}}"}</code> и др.
              </p>
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <TapScaleButton
                    type="button"
                    subtle
                    haptic
                    className="flex min-h-[var(--uix-touch-min)] w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/50 px-2.5 py-1.5 uix-text-caption font-medium text-foreground data-[state=open]:[&_svg]:rotate-180"
                    aria-label="Справка по кодам приглашений"
                  >
                    <span>Как устроены коды и плейсхолдеры</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" aria-hidden />
                  </TapScaleButton>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden pt-2">
                  <p className="uix-text-caption text-muted-foreground leading-snug">
                    Коды в той же системе, что обычные приглашения PING; списание использований атомарное. «Кто пригласил»
                    — сам участник, не автор кампании. Между запросами пака — пауза ~45 сек. Плейсхолдеры:{" "}
                    <code className="rounded bg-muted px-1">{"{{count}}"}</code>,{" "}
                    <code className="rounded bg-muted px-1">{"{{codes}}"}</code>,{" "}
                    <code className="rounded bg-muted px-1">{"{{maxUses}}"}</code>,{" "}
                    <code className="rounded bg-muted px-1">{"{{appLink}}"}</code> (
                    <code className="rounded bg-muted px-1">PING_INVITE_APP_URL</code>). Пустой шаблон — готовый текст от сервера.
                  </p>
                </CollapsibleContent>
              </Collapsible>
              <div>
                <Label htmlFor="ping-invite-issue-mode">Режим выдачи кодов</Label>
                <select
                  id="ping-invite-issue-mode"
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={pingInviteIssueMode}
                  onChange={(e) =>
                    setPingInviteIssueMode(
                      e.target.value as "batch_min_count" | "single_per_request" | "one_multi_use",
                    )
                  }
                  aria-label="Режим выдачи пригласительных кодов"
                >
                  <option value="batch_min_count">
                    Пакет одноразовых за раз (сколько кодов = «мин. кол-во» в задании, не больше 50)
                  </option>
                  <option value="single_per_request">
                    По одному одноразовому коду за запрос (запрашивать снова можно без лимита по числу кодов)
                  </option>
                  <option value="one_multi_use">Один код на несколько регистраций (лимит ниже)</option>
                </select>
              </div>
              {pingInviteIssueMode === "one_multi_use" ? (
                <div>
                  <Label htmlFor="ping-invite-multi-max">
                    Сколько человек могут зарегистрироваться одним кодом (2–10 000)
                  </Label>
                  <Input
                    id="ping-invite-multi-max"
                    type="number"
                    min={2}
                    max={10000}
                    className="mt-1.5"
                    value={pingInviteMultiUseMax}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      setPingInviteMultiUseMax(Number.isFinite(n) ? Math.min(10000, Math.max(2, n)) : 50);
                    }}
                  />
                </div>
              ) : null}
              <Textarea
                value={pingInviteTemplate}
                onChange={(e) => setPingInviteTemplate(e.target.value)}
                placeholder="Спасибо за участие! (вставьте {{codes}} в текст или оставьте пустым — сервер добавит готовую формулировку и список кодов)"
                rows={6}
                aria-label="Шаблон личного сообщения с кодами приглашения"
              />
              <div>
                <Label htmlFor="ping-invite-hours">Срок действия каждого кода, часы (1–720)</Label>
                <Input
                  id="ping-invite-hours"
                  type="number"
                  min={1}
                  max={720}
                  className="mt-1.5"
                  value={pingInviteHours}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    setPingInviteHours(Number.isFinite(n) ? Math.min(720, Math.max(1, n)) : 168);
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <>
            <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 space-y-2">
              <p className="text-sm font-medium text-foreground">Задания и рейтинги</p>
              <p className="uix-text-caption text-muted-foreground leading-snug">
                В каждой карточке выберите поле «Рейтинг для очков»: основной или дополнительный — так участник видит
                задания отдельно на экране «Задания» и очки попадают в нужную таблицу. По умолчанию: блок «игра» →
                основной; «глобальные» и «коммерческие» → дополнительный. Порог «сколько раз / дней» — в полях скрипта.
              </p>
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <TapScaleButton
                    type="button"
                    subtle
                    haptic
                    className="flex min-h-[var(--uix-touch-min)] w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 uix-text-caption font-medium text-foreground data-[state=open]:[&_svg]:rotate-180"
                    aria-label="Развернуть справку по заданиям"
                  >
                    <span>Справка: блоки, поля XP, срок</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" aria-hidden />
                  </TapScaleButton>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden pt-1">
                  <div className="mt-2 space-y-2 rounded-xl border border-border/50 bg-background/70 p-2.5 uix-text-caption text-muted-foreground">
                    <p>
                      В блоке «игра» — действия и счётчики персонажа в EDGE (заходы, тапы, кормления, туалет, поиграть,
                      успокоить, погладить). В «глобальных» и «коммерческих» — активность во всём PING: рефералы, посты,
                      профиль, комментарии и реакции.
                    </p>
                    <p className="text-foreground font-medium">Числа в карточке задания</p>
                    <ul className="list-disc space-y-1 pl-4">
                      <li>
                        <strong className="text-foreground">XP за выполнение</strong> — награда после выполнения условия.
                      </li>
                      <li>
                        <strong className="text-foreground">Штраф XP</strong> — списание при штрафе (часто 0).
                      </li>
                      <li>
                        <strong className="text-foreground">Срок, дн.</strong> — за сколько дней закрыть задание после старта.
                      </li>
                    </ul>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
            <TaskSection
              scope="game"
              title="Задания игры (персонаж)"
              scoreHint="По умолчанию очки — в основной рейтинг; при необходимости смените в карточке."
              rows={tasksGame}
              setRows={setTasksGame}
            />
            <TaskSection
              scope="global"
              title="Глобальные задания"
              scoreHint="По умолчанию — дополнительный рейтинг; можно явно выбрать основной, если задание про игру."
              rows={tasksGlobal}
              setRows={setTasksGlobal}
            />
            <TaskSection
              scope="commercial"
              title="Коммерческие задания"
              scoreHint="По умолчанию — дополнительный рейтинг; переключатель в каждой карточке."
              rows={tasksCommercial}
              setRows={setTasksCommercial}
            />
          </>
        ) : null}

        {step === 6 ? (
          <div className="space-y-4">
            <p className="uix-text-caption text-muted-foreground leading-snug">
              Подсказки для участников и дата окончания. Текстовые поля ниже{" "}
              <span className="text-foreground font-medium">не</span> запускают розыгрыш по расписанию — только дата
              блокирует игру.
            </p>
            <Collapsible>
              <CollapsibleTrigger asChild>
                <TapScaleButton
                  type="button"
                  subtle
                  haptic
                  className="flex min-h-[var(--uix-touch-min)] w-full items-center justify-between gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 uix-text-caption font-medium text-foreground data-[state=open]:[&_svg]:rotate-180 dark:border-amber-400/30 dark:bg-amber-400/10"
                  aria-label="Подробнее про автоматику сроков"
                >
                  <span>Подробнее: что считается автоматикой</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" aria-hidden />
                </TapScaleButton>
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden pt-2">
                <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2 uix-text-caption text-muted-foreground space-y-2">
                  <p>
                    Строки «итоги по субботам» и «сброс по воскресеньям» — только текст в UI. Парсера дат нет, авто-draw и
                    авто-сброс рейтинга по ним не выполняются.
                  </p>
                  <p>
                    Розыгрыш — отдельное действие в списке кампаний. Единственное поле с реальной блокировкой после наступления
                    даты — «Дата завершения кампании».
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
            <div>
              <Label htmlFor="draw-hint">Текст про подведение итогов</Label>
              <Input
                id="draw-hint"
                value={drawSummary}
                onChange={(e) => setDrawSummary(e.target.value)}
                placeholder="Например: Итоги публикуем по субботам в 20:00"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="reset-hint">Текст про сброс рейтинга</Label>
              <Input
                id="reset-hint"
                value={resetSummary}
                onChange={(e) => setResetSummary(e.target.value)}
                placeholder="Например: Рейтинг обновляем по воскресеньям"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ends">Дата завершения кампании</Label>
              <Input
                id="ends"
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1.5"
              />
              <p className="mt-1 uix-text-caption text-muted-foreground leading-snug">
                После этой даты участие и действия в кампании блокируются.
              </p>
            </div>
          </div>
        ) : null}

        {step === 7 ? (
          <div className="space-y-4">
            <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-3">
              <p className="text-sm font-medium text-foreground">Рейтинги в кампании</p>
              <p className="uix-text-caption text-muted-foreground leading-snug">
                Какие таблицы очков показать в компаньоне. Обе включены — две вкладки лидерборда. Какое задание в какой
                рейтинг идёт, задаётся на шаге «Задания» в поле «Рейтинг для очков» у каждой карточки.
              </p>
              <label className="flex items-start justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">Основной рейтинг</span>
                  <span className="mt-0.5 block uix-text-caption text-muted-foreground leading-snug">
                    Тапы, уход, уровень и задания, у которых на шаге «Задания» выбран «основной» рейтинг.
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={leaderboardPrimaryEnabled}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setLeaderboardPrimaryEnabled(next);
                    if (!next && !leaderboardSecondaryEnabled) setLeaderboardSecondaryEnabled(true);
                  }}
                  aria-label="Включить основной рейтинг"
                />
              </label>
              <label className="flex items-start justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">Дополнительный рейтинг</span>
                  <span className="mt-0.5 block uix-text-caption text-muted-foreground leading-snug">
                    На шаге «Задания» отметьте у карточки «дополнительный» рейтинг — тогда XP за это задание попадёт
                    сюда (рефералы, лента, комментарии, реакции и т.д.).
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={leaderboardSecondaryEnabled}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setLeaderboardSecondaryEnabled(next);
                    if (!next && !leaderboardPrimaryEnabled) setLeaderboardPrimaryEnabled(true);
                  }}
                  aria-label="Включить дополнительный рейтинг"
                />
              </label>
              {detailQ.data?.leaderboardPrimaryFrozenEffective ? (
                <div
                  className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 dark:border-amber-400/35 dark:bg-amber-400/10"
                  role="status"
                >
                  <p className="text-sm text-foreground">
                    Основной рейтинг на паузе: наступила дата розыгрыша приза и/или выставлена ручная заморозка.
                    Кнопка снимает оба варианта.
                  </p>
                  <TapScaleButton
                    type="button"
                    haptic
                    className="mt-2 min-h-[var(--uix-touch-min)] rounded-lg border border-border bg-background px-3 py-2 uix-text-caption font-medium"
                    disabled={resumePrimaryMut.isPending || !edgeIdParam}
                    onClick={() => resumePrimaryMut.mutate()}
                    aria-label="Возобновить начисление основного рейтинга"
                  >
                    {resumePrimaryMut.isPending ? "Сохранение…" : "Возобновить начисление (основной)"}
                  </TapScaleButton>
                </div>
              ) : null}
              {detailQ.data?.leaderboardSecondaryFrozenEffective ? (
                <div
                  className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 dark:border-amber-400/35 dark:bg-amber-400/10"
                  role="status"
                >
                  <p className="text-sm text-foreground">
                    Дополнительный рейтинг на паузе: дата розыгрыша и/или ручная заморозка. Кнопка снимает оба
                    варианта.
                  </p>
                  <TapScaleButton
                    type="button"
                    haptic
                    className="mt-2 min-h-[var(--uix-touch-min)] rounded-lg border border-border bg-background px-3 py-2 uix-text-caption font-medium"
                    disabled={resumeSecondaryMut.isPending || !edgeIdParam}
                    onClick={() => resumeSecondaryMut.mutate()}
                    aria-label="Возобновить начисление дополнительного рейтинга"
                  >
                    {resumeSecondaryMut.isPending ? "Сохранение…" : "Возобновить начисление (дополнительный)"}
                  </TapScaleButton>
                </div>
              ) : null}
            </div>
            <p className="text-sm font-medium text-foreground">Кому показывать пост с EDGE</p>
            <p className="uix-text-caption text-muted-foreground">
              Настройка влияет на карточку в профиле и на попадание в общую ленту. Пост с кампанией всё равно нужно
              опубликовать отдельно.
            </p>
            <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3">
              {(
                [
                  {
                    value: "self" as const,
                    title: "Только себе",
                    hint: "Видите вы в своём профиле. Другие не увидят пост с игрой и не откроют компаньон по ссылке.",
                  },
                  {
                    value: "followers" as const,
                    title: "Только подписчикам",
                    hint: "Видят подписчики в вашем профиле и в общей ленте. Остальные — нет.",
                  },
                  {
                    value: "public" as const,
                    title: "Всем в общей ленте",
                    hint: "Как обычный публичный пост: все видят в ленте и в профиле (если пост не скрыт настройками самого поста).",
                  },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${
                    displayAudience === opt.value ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="edge-display-audience"
                    className="mt-1 h-4 w-4 shrink-0"
                    checked={displayAudience === opt.value}
                    onChange={() => setDisplayAudience(opt.value)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{opt.title}</span>
                    <span className="mt-0.5 block uix-text-caption text-muted-foreground leading-snug">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {step === 8 ? (
          <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-sm font-medium">Готово</p>
            <p className="uix-text-caption text-muted-foreground">
              Чтобы EDGE реально появился в ленте, нужны 2 действия:
            </p>
            <ol className="list-decimal space-y-1 pl-5 uix-text-caption text-muted-foreground">
              <li>Нажмите «Опубликовать кампанию» (статус кампании станет активным).</li>
              <li>
                Откроется создание поста с уже подставленным <code className="rounded bg-muted px-1">edgeId</code> —
                опубликуйте этот пост.
              </li>
            </ol>

            {edgeIdParam ? (
              <div className="space-y-3 rounded-xl border border-primary/15 bg-primary/[0.04] p-3 dark:bg-primary/[0.06]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">Статистика «рейтинг жизни»</p>
                  <TapScaleButton
                    type="button"
                    subtle
                    haptic
                    className="min-h-[var(--uix-touch-min)] uix-text-caption"
                    disabled={lifeStatsQ.isFetching}
                    onClick={() => void lifeStatsQ.refetch()}
                  >
                    Обновить
                  </TapScaleButton>
                </div>
                <p className="uix-text-caption text-muted-foreground leading-snug">
                  Участники с заходом в компаньон. Очередь — невыполненные запросы персонажа.
                </p>
                {lifeStatsQ.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-2/3 rounded-md" />
                    <Skeleton className="h-4 w-1/2 rounded-md" />
                  </div>
                ) : null}
                {lifeStatsQ.isError ? (
                  <ErrorWithRetry
                    title="Не удалось загрузить статистику"
                    description={
                      lifeStatsQ.error instanceof Error ? lifeStatsQ.error.message : "Повторите запрос."
                    }
                    onRetry={() => void lifeStatsQ.refetch()}
                    className="min-h-[100px] rounded-lg border border-border/50 bg-background/80"
                  />
                ) : null}
                {lifeStatsQ.data ? (
                  <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
                    <div className="flex justify-between gap-2 rounded-lg bg-background/60 px-2 py-1.5 dark:bg-background/40">
                      <dt className="text-muted-foreground">Участников кампании</dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {lifeStatsQ.data.totalParticipants}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 rounded-lg bg-background/60 px-2 py-1.5 dark:bg-background/40">
                      <dt className="text-muted-foreground">Состояние персонажа</dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {lifeStatsQ.data.withCharacterState}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 rounded-lg bg-background/60 px-2 py-1.5 dark:bg-background/40">
                      <dt className="text-muted-foreground">С рейтингом жизни</dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {lifeStatsQ.data.withLifeRating}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 rounded-lg bg-background/60 px-2 py-1.5 dark:bg-background/40">
                      <dt className="text-muted-foreground">Средняя жизнь</dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {lifeStatsQ.data.avgLifeRating != null
                          ? lifeStatsQ.data.avgLifeRating.toFixed(1)
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 rounded-lg bg-background/60 px-2 py-1.5 dark:bg-background/40">
                      <dt className="text-muted-foreground">Мин / макс жизни</dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {lifeStatsQ.data.minLifeRating != null && lifeStatsQ.data.maxLifeRating != null
                          ? `${Math.round(lifeStatsQ.data.minLifeRating)} / ${Math.round(lifeStatsQ.data.maxLifeRating)}`
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 rounded-lg bg-background/60 px-2 py-1.5 dark:bg-background/40">
                      <dt className="text-muted-foreground">Запросов в очередях</dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {lifeStatsQ.data.totalQueuedNeeds}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 rounded-lg bg-background/60 px-2 py-1.5 sm:col-span-2 dark:bg-background/40">
                      <dt className="text-muted-foreground">Участников с непустой очередью</dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {lifeStatsQ.data.participantsWithPendingQueue}
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            ) : null}

            <TapScaleButton
              type="button"
              haptic
              className="w-full min-h-[var(--uix-touch-min)] rounded-xl bg-primary px-4 py-3 text-primary-foreground font-semibold"
              disabled={!edgeIdParam || publishMut.isPending}
              onClick={() => publishMut.mutate()}
            >
              {publishMut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Опубликовать кампанию"}
            </TapScaleButton>
            <TapScaleButton
              type="button"
              haptic
              subtle
              className="w-full min-h-[var(--uix-touch-min)] rounded-xl border border-border py-3 font-medium"
              onClick={() => setLocation(`/create-post?edgeId=${encodeURIComponent(edgeIdParam)}`)}
              disabled={!edgeIdParam}
            >
              Создать пост с EDGE
            </TapScaleButton>
            <TapScaleButton
              type="button"
              haptic
              subtle
              className="w-full min-h-[var(--uix-touch-min)] rounded-xl border border-border py-3 font-medium"
              onClick={() => setLocation("/board/edge/manage")}
            >
              К списку кампаний
            </TapScaleButton>
          </div>
        ) : null}

        {step > 0 && step < STEPS.length - 1 ? (
          <div className="flex gap-2 pt-2">
            <TapScaleButton
              type="button"
              haptic
              subtle
              className="min-h-[var(--uix-touch-min)] flex-1 rounded-xl border border-border py-3 font-medium"
              disabled={step <= 1 || isBusy}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              Назад
            </TapScaleButton>
            <TapScaleButton
              type="button"
              haptic
              className="min-h-[var(--uix-touch-min)] flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60"
              disabled={isBusy}
              onClick={() => void goNext()}
            >
              {step === 0 ? "Создать черновик" : isBusy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Далее"}
            </TapScaleButton>
          </div>
        ) : null}

        {!edgeIdParam && step === 0 ? (
          <TapScaleButton
            type="button"
            haptic
            className="min-h-[var(--uix-touch-min)] w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60"
            disabled={createMut.isPending}
            onClick={() => void goNext()}
          >
            {createMut.isPending ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Создать черновик"}
          </TapScaleButton>
        ) : null}
      </div>
    </div>
  );
}

function TaskSection({
  scope,
  title,
  scoreHint,
  rows,
  setRows,
}: {
  scope: TaskScope;
  title: string;
  /** Куда уходит XP из этого блока (основной / доп. рейтинг). */
  scoreHint: string;
  rows: TaskRow[];
  setRows: Dispatch<SetStateAction<TaskRow[]>>;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-border/50 bg-muted/10 p-3">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 uix-text-caption text-muted-foreground leading-snug">{scoreHint}</p>
      </div>
      {rows.map((r) => (
        <div key={r.localId} className="space-y-2 rounded-xl border border-border/40 bg-background p-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Скрипт / тип проверки</Label>
            <select
              className="h-9 min-h-[var(--uix-touch-min)] w-full max-w-xl rounded-md border border-input bg-background px-2 text-sm"
              value={r.verifyType}
              aria-label="Шаблон задания и тип проверки"
              onChange={(e) => {
                const next = e.target.value as TaskVerifyUi;
                const b = blueprintMeta(next);
                const v = parsePresetVerify({ type: next });
                setRows((prev) =>
                  prev.map((x) =>
                    x.localId === r.localId
                      ? {
                          ...x,
                          label: b.defaultLabel,
                          ...verifyFieldsFromParsed(v),
                        }
                      : x,
                  ),
                );
              }}
            >
              {selectOptionsForRow(scope, r.verifyType).map((b) => (
                <option key={b.verifyType} value={b.verifyType}>
                  {b.optionLabel}
                </option>
              ))}
            </select>
            <p className="uix-text-caption text-muted-foreground leading-snug">{blueprintMeta(r.verifyType).help}</p>
            {r.verifyType === "honor" ? (
              <p className="rounded-lg border border-destructive/35 bg-destructive/10 px-2 py-1.5 uix-text-caption text-destructive">
                XP выдаётся без проверки факта. Для конкурсов с призами выбирайте типы с автопроверкой выше.
              </p>
            ) : null}
            <div>
              <Label className="text-xs text-muted-foreground">Рейтинг для очков</Label>
              <select
                className="mt-1 h-9 min-h-[var(--uix-touch-min)] w-full max-w-xl rounded-md border border-input bg-background px-2 text-sm"
                value={r.scoreTarget}
                aria-label="В какой рейтинг засчитывать XP за это задание"
                onChange={(e) => {
                  const v = e.target.value as "primary" | "secondary";
                  setRows((prev) =>
                    prev.map((x) => (x.localId === r.localId ? { ...x, scoreTarget: v } : x)),
                  );
                }}
              >
                <option value="primary">Основной (игра, персонаж)</option>
                <option value="secondary">Дополнительный (лента, активность)</option>
              </select>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 border-t border-border/30 pt-2">
            <div>
              <Label className="text-xs text-muted-foreground">Текст для людей (можно изменить)</Label>
              <Input
                placeholder="Как показать задание участнику"
                value={r.label}
                className="mt-1"
                onChange={(e) => {
                  const v = e.target.value;
                  setRows((prev) => prev.map((x) => (x.localId === r.localId ? { ...x, label: v } : x)));
                }}
              />
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">XP за выполнение</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    min={0}
                    title="XP за выполнение"
                    value={r.points}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      setRows((prev) =>
                        prev.map((x) => (x.localId === r.localId ? { ...x, points: Number.isFinite(n) ? n : 0 } : x)),
                      );
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Штраф XP</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    min={0}
                    title="Штраф XP"
                    value={r.penalty}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      setRows((prev) =>
                        prev.map((x) => (x.localId === r.localId ? { ...x, penalty: Number.isFinite(n) ? n : 0 } : x)),
                      );
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Срок, дн.</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    min={1}
                    title="Срок в днях"
                    value={r.deadlineDays}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      setRows((prev) =>
                        prev.map((x) =>
                          x.localId === r.localId ? { ...x, deadlineDays: Number.isFinite(n) ? Math.max(1, n) : 1 } : x,
                        ),
                      );
                    }}
                  />
                </div>
              </div>
              <p className="uix-text-caption text-muted-foreground leading-snug">
                Порог выполнения — в полях ниже по выбранному скрипту.
              </p>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <TapScaleButton
                type="button"
                subtle
                haptic
                aria-label="Удалить задание"
                className="p-2 text-destructive min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]"
                onClick={() => setRows((prev) => prev.filter((x) => x.localId !== r.localId))}
              >
                <Trash2 className="h-4 w-4" />
              </TapScaleButton>
            </div>
          </div>
          <div className="space-y-2 border-t border-border/30 pt-2">
            {r.verifyType === "react_post" || r.verifyType === "comment_post" ? (
              <Input
                placeholder="UUID поста (с привязкой edgeId к этой кампании)"
                value={r.verifyPostId}
                onChange={(e) => {
                  const v = e.target.value;
                  setRows((prev) => prev.map((x) => (x.localId === r.localId ? { ...x, verifyPostId: v } : x)));
                }}
              />
            ) : null}
            {r.verifyType === "comment_post" ? (
              <div>
                <Label className="text-xs text-muted-foreground">{minCountLabelForType(r.verifyType)}</Label>
                <Input
                  type="number"
                  className="mt-1 w-28"
                  title="Мин. комментариев"
                  value={r.verifyMinCount}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    setRows((prev) =>
                      prev.map((x) =>
                        x.localId === r.localId ? { ...x, verifyMinCount: Number.isFinite(n) ? Math.max(1, n) : 1 } : x,
                      ),
                    );
                  }}
                />
                <p className="mt-1 uix-text-caption text-muted-foreground">{minCountHintForType(r.verifyType)}</p>
              </div>
            ) : null}
            {r.verifyType === "edge_min_level" ? (
              <div>
                <Label className="text-xs text-muted-foreground">Минимальный уровень</Label>
                <Input
                  type="number"
                  className="mt-1 w-28"
                  title="Уровень"
                  value={r.verifyMinLevel}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    setRows((prev) =>
                      prev.map((x) =>
                        x.localId === r.localId ? { ...x, verifyMinLevel: Number.isFinite(n) ? Math.max(1, n) : 1 } : x,
                      ),
                    );
                  }}
                />
                <p className="mt-1 uix-text-caption text-muted-foreground">Например: 4 = достигнуть 4 уровня персонажа.</p>
              </div>
            ) : null}
            {r.verifyType === "edge_min_xp" ? (
              <div>
                <Label className="text-xs text-muted-foreground">Минимум XP персонажа</Label>
                <Input
                  type="number"
                  className="mt-1 w-32"
                  title="XP"
                  value={r.verifyMinXp}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    setRows((prev) =>
                      prev.map((x) =>
                        x.localId === r.localId ? { ...x, verifyMinXp: Number.isFinite(n) ? Math.max(0, n) : 0 } : x,
                      ),
                    );
                  }}
                />
                <p className="mt-1 uix-text-caption text-muted-foreground">Например: 500 = накопить 500 XP в кампании.</p>
              </div>
            ) : null}
            {needsVerifyMinDaysField(r.verifyType) ? (
              <div>
                <Label className="text-xs text-muted-foreground">
                  {r.verifyType === "edge_game_login_streak"
                    ? "Минимум дней захода подряд"
                    : "Минимум дней серии заботы"}
                </Label>
                <Input
                  type="number"
                  className="mt-1 w-28"
                  title="Дней"
                  min={1}
                  value={r.verifyMinDays}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    setRows((prev) =>
                      prev.map((x) =>
                        x.localId === r.localId ? { ...x, verifyMinDays: Number.isFinite(n) ? Math.max(1, n) : 1 } : x,
                      ),
                    );
                  }}
                />
                <p className="mt-1 uix-text-caption text-muted-foreground">
                  Например: 3 = выполнить условие 3 дня подряд без пропусков.
                </p>
              </div>
            ) : null}
            {needsVerifyMinCountField(r.verifyType) ? (
              <div>
                <Label className="text-xs text-muted-foreground">{minCountLabelForType(r.verifyType)}</Label>
                <Input
                  type="number"
                  className="mt-1 w-28"
                  min={1}
                  title="Порог"
                  value={r.verifyMinCount}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    setRows((prev) =>
                      prev.map((x) =>
                        x.localId === r.localId
                          ? { ...x, verifyMinCount: Number.isFinite(n) ? Math.max(1, n) : 1 }
                          : x,
                      ),
                    );
                  }}
                />
                <p className="mt-1 uix-text-caption text-muted-foreground">{minCountHintForType(r.verifyType)}</p>
              </div>
            ) : null}
          </div>
        </div>
      ))}
      <TapScaleButton
        type="button"
        subtle
        haptic
        className="inline-flex min-h-[var(--uix-touch-min)] items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 uix-text-caption"
        onClick={() => setRows((p) => [...p, emptyTaskForScope(scope)])}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Добавить задание
      </TapScaleButton>
    </div>
  );
}
