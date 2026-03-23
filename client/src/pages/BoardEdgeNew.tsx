import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ChevronLeft, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorWithRetry } from "@/components/ui/empty";
import { useToast } from "@/hooks/use-toast";
import { uploadPostMedia } from "@/lib/posts";
import {
  createEdgeCampaignDraft,
  fetchEdgeCampaignDetail,
  parseGiftTemplatesFromRow,
  patchEdgeCampaign,
  type EdgeGiftTemplateInput,
  edgeCreatorDestructiveToast,
} from "@/lib/edge-creator";
import { parsePresetVerify, type PresetVerify } from "@shared/edge-task-preset-config";

const STEPS = [
  "Название",
  "Персонаж",
  "Призы",
  "Победители",
  "Подписка",
  "Задания",
  "Сроки",
  "Готово",
] as const;

type TaskVerifyUi = PresetVerify["type"];

type TaskRow = {
  localId: string;
  /** Стабильный ключ для API (`game_0` …); после сохранения не меняем. */
  key: string;
  label: string;
  points: number;
  penalty: number;
  deadlineDays: number;
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
    return {
      localId: newLocalId(),
      key,
      label: typeof o.label === "string" ? o.label : "",
      points: typeof o.points === "number" ? o.points : 10,
      penalty: typeof o.penalty === "number" ? o.penalty : 0,
      deadlineDays: typeof o.deadlineDays === "number" ? o.deadlineDays : 7,
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
  const [gifts, setGifts] = useState<EdgeGiftTemplateInput[]>([{ title: "Главный приз", quantity: 1 }]);
  const [prizePool, setPrizePool] = useState<"all" | "top">("all");
  const [prizeMethod, setPrizeMethod] = useState<"random" | "first">("random");
  const [prizeTopN, setPrizeTopN] = useState(50);
  const [followRewardXp, setFollowRewardXp] = useState(false);
  const [followDmEnabled, setFollowDmEnabled] = useState(false);
  const [followDmText, setFollowDmText] = useState("");
  const [followDmMediaUrl, setFollowDmMediaUrl] = useState("");
  /** Шаблон ЛС с кодами для заданий `ping_invited_users` (плейсхолдеры {{codes}}, {{count}}). */
  const [pingInviteTemplate, setPingInviteTemplate] = useState("");
  const [pingInviteHours, setPingInviteHours] = useState(168);
  const [tasksGame, setTasksGame] = useState<TaskRow[]>([]);
  const [tasksGlobal, setTasksGlobal] = useState<TaskRow[]>([]);
  const [tasksCommercial, setTasksCommercial] = useState<TaskRow[]>([]);
  const [drawSummary, setDrawSummary] = useState("");
  const [resetSummary, setResetSummary] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const hydratedFor = useRef("");
  const characterFileInputRef = useRef<HTMLInputElement>(null);
  const [characterUploading, setCharacterUploading] = useState(false);

  const detailQ = useQuery({
    queryKey: ["edge", "creator", "detail", edgeIdParam],
    queryFn: () => fetchEdgeCampaignDetail(edgeIdParam),
    enabled: Boolean(edgeIdParam),
    retry: 1,
  });

  useEffect(() => {
    const d = detailQ.data;
    if (!d || hydratedFor.current === d.edgeId) return;
    hydratedFor.current = d.edgeId;
    setCampaignTitle(d.title);
    const parsedGifts = parseGiftTemplatesFromRow(d.giftsJson);
    setGifts(parsedGifts.length ? parsedGifts : [{ title: "Главный приз", quantity: 1 }]);
    setFollowRewardXp(d.followRewardEnabled);
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
    const tp = readCfg(root.taskPresets);
    setTasksGame(readTasks(tp.game, "game"));
    setTasksGlobal(readTasks(tp.global, "global"));
    setTasksCommercial(readTasks(tp.commercial, "commercial"));
    const sk = `edgeWizard:${d.edgeId}:step`;
    const saved = sessionStorage.getItem(sk);
    const n = saved ? Number.parseInt(saved, 10) : NaN;
    setStep(Number.isFinite(n) && n >= 1 && n <= 7 ? n : 1);
  }, [detailQ.data]);

  useEffect(() => {
    if (!edgeIdParam) return;
    sessionStorage.setItem(`edgeWizard:${edgeIdParam}:step`, String(step));
  }, [edgeIdParam, step]);

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
    },
    [edgeIdParam, qc],
  );

  const onUploadCharacter = async (file: File | null, inputEl: HTMLInputElement | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Нужен файл изображения (PNG, JPEG или WebP)", variant: "destructive" });
      if (inputEl) inputEl.value = "";
      return;
    }
    setCharacterUploading(true);
    try {
      const url = await uploadPostMedia(file);
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
        });
      }
      if (step === 2) {
        await savePatch({ giftsTemplates: gifts.filter((g) => g.title.trim()) });
      }
      if (step === 3) {
        await savePatch({
          prizeRules: { pool: prizePool, method: prizeMethod, topN: prizeTopN },
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
        <p className="uix-text-caption text-muted-foreground">
          Шаг {step + 1}/{STEPS.length}: {STEPS[step]}
        </p>
        {edgeIdParam ? (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground break-all">edgeId: {edgeIdParam}</p>
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
            <p className="uix-text-caption text-muted-foreground">
              Тип: <strong>Персонаж</strong> (единственный вариант в каталоге). После создания черновика
              загрузите PNG и настройте призы.
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
                    PNG с альфа-каналом предпочтителен. Файл загрузится на сервер сразу после выбора.
                  </p>
                )}
              </div>
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
                        const url = await uploadPostMedia(f);
                        const isVideo = f.type.startsWith("video/");
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
              </div>
            ))}
            <TapScaleButton
              type="button"
              haptic
              subtle
              className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 uix-text-caption"
              onClick={() => setGifts((p) => [...p, { title: "", quantity: 1 }])}
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
            <div className="rounded-2xl border border-border/50 bg-muted/10 px-3 py-2">
              <p className="uix-text-caption font-medium text-foreground">Сообщение за подписку (авто-ЛС)</p>
              <p className="mt-1 uix-text-caption text-muted-foreground">
                Уходит от вашего имени в личку человеку, который только что подписался и получил XP за эту кампанию.
                Включите «Авто-сообщение…», введите текст и при необходимости прикрепите медиа. Без галочки и текста письма
                не будет.
              </p>
            </div>
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
                    const url = await uploadPostMedia(f);
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
              <p className="uix-text-caption text-muted-foreground">
                У каждого участника свой набор кодов: при нажатии «Коды в ЛС» в игре сервер создаёт новые одноразовые коды и
                шлёт одно сообщение этому человеку. Число кодов = порог в задании («мин. кол-во»). Если в тексте нет{" "}
                <code className="rounded bg-muted px-1">{"{{codes}}"}</code>, список кодов всё равно будет добавлен в конец
                сообщения. Плейсхолдеры: <code className="rounded bg-muted px-1">{"{{count}}"}</code>,{" "}
                <code className="rounded bg-muted px-1">{"{{codes}}"}</code>,{" "}
                <code className="rounded bg-muted px-1">{"{{appLink}}"}</code> (см.{" "}
                <code className="rounded bg-muted px-1">PING_INVITE_APP_URL</code> на сервере). Пустой шаблон — текст по
                умолчанию с явной фразой про коды.
              </p>
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
            <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 uix-text-caption text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">Скрипты заданий</p>
              <p>
                В блоке «игра» — действия и счётчики персонажа в EDGE (заходы, тапы, кормления, туалет, поиграть,
                успокоить, погладить). В «глобальных» и «коммерческих» — активность во всём PING: рефералы, посты,
                профиль, комментарии и реакции. Порог задаётся числом в поле ниже (дней подряд, раз за день, всего
                приглашений и т.д.).
              </p>
              <div className="rounded-xl border border-border/50 bg-background/70 p-2.5 space-y-1.5">
                <p className="text-foreground font-medium">Что означают числа в карточке задания</p>
                <p>
                  <strong>XP за выполнение</strong> — сколько очков получит участник после прохождения задания.
                </p>
                <p>
                  <strong>Штраф XP</strong> — сколько очков снимется при штрафе (обычно 0, если штрафы не нужны).
                </p>
                <p>
                  <strong>Срок, дн.</strong> — за сколько дней нужно закрыть задание после его старта.
                </p>
              </div>
            </div>
            <TaskSection scope="game" title="Задания игры (персонаж)" rows={tasksGame} setRows={setTasksGame} />
            <TaskSection scope="global" title="Глобальные задания" rows={tasksGlobal} setRows={setTasksGlobal} />
            <TaskSection
              scope="commercial"
              title="Коммерческие задания"
              rows={tasksCommercial}
              setRows={setTasksCommercial}
            />
          </>
        ) : null}

        {step === 6 ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-3 py-2">
              <p className="uix-text-caption font-medium text-foreground">Важно про автоматику</p>
              <p className="mt-1 uix-text-caption text-muted-foreground">
                Поля ниже сейчас используются как текстовые подсказки для участников. Система не парсит слова
                «суббота/воскресенье» и не запускает авто-розыгрыш или авто-сброс рейтинга по этим строкам.
              </p>
            </div>
            <div>
              <Label htmlFor="draw-hint">Текст про подведение итогов (только для отображения)</Label>
              <Input
                id="draw-hint"
                value={drawSummary}
                onChange={(e) => setDrawSummary(e.target.value)}
                placeholder="Например: Итоги публикуем по субботам в 20:00"
                className="mt-1.5"
              />
              <p className="mt-1 uix-text-caption text-muted-foreground">
                Это текст в интерфейсе. Сам розыгрыш запускается отдельно (ручной draw через админ-поток).
              </p>
            </div>
            <div>
              <Label htmlFor="reset-hint">Текст про сброс рейтинга (только для отображения)</Label>
              <Input
                id="reset-hint"
                value={resetSummary}
                onChange={(e) => setResetSummary(e.target.value)}
                placeholder="Например: Рейтинг обновляем по воскресеньям"
                className="mt-1.5"
              />
              <p className="mt-1 uix-text-caption text-muted-foreground">
                Это тоже только подсказка для людей. Автоматический reset по расписанию сейчас не включён.
              </p>
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
              <p className="mt-1 uix-text-caption text-muted-foreground">
                Это единственное поле со встроенной автоматикой: после даты участия/действия блокируются.
              </p>
            </div>
          </div>
        ) : null}

        {step === 7 ? (
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

        {step > 0 && step < 7 ? (
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
  rows,
  setRows,
}: {
  scope: TaskScope;
  title: string;
  rows: TaskRow[];
  setRows: Dispatch<SetStateAction<TaskRow[]>>;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-border/50 bg-muted/10 p-3">
      <p className="text-sm font-semibold">{title}</p>
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
              <p className="uix-text-caption text-muted-foreground">
                Эти 3 числа отвечают только за награду/штраф/срок. Факт выполнения проверяется в блоке ниже по типу
                скрипта.
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
