import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutGrid,
  Loader2,
  Play,
  Pause,
  Ban,
  RotateCcw,
  Zap,
  Trash2,
  ExternalLink,
  Upload,
  CalendarDays,
  Music2,
} from "lucide-react";
import { AdminPanelCard, adminSkeletonClass } from "@/features/admin-shell";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ListEmptyState, ErrorWithRetry } from "@/components/ui/empty";
import { useToast } from "@/hooks/use-toast";
import { TapScaleButton } from "@/components/ui/tap-scale";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PostVideoTrimmerModal } from "@/features/posts/video-trim";
import { uploadPostMedia, uploadPostMediaImageResized, type PostVideoTrimUpload } from "@/lib/posts";
import { POST_VIDEO_MAX_SECONDS } from "@shared/post-video";
import {
  addMediaStudioCampaignPost,
  createMediaStudioCampaign,
  deleteMediaStudioCampaignPost,
  fetchMediaStudioCampaignDetail,
  fetchMediaStudioCampaigns,
  fetchStudioSyntheticUsers,
  patchMediaStudioCampaign,
  tickMediaStudioCampaign,
  type MediaStudioCampaign,
  type MediaStudioCampaignPost,
} from "./api";

const QK_CAMPAIGNS = ["admin", "media-studio", "campaigns"] as const;
const SS_SELECTED = "admin-media-studio-campaign-id";

type CampaignListRow = MediaStudioCampaign & { queuedCount?: number };

function statusLabel(s: MediaStudioCampaign["status"]): string {
  switch (s) {
    case "draft":
      return "Черновик";
    case "running":
      return "Идёт";
    case "paused":
      return "Пауза";
    case "completed":
      return "Завершена";
    case "cancelled":
      return "Отменена";
    default:
      return s;
  }
}

function postStateLabel(s: MediaStudioCampaignPost["state"]): string {
  switch (s) {
    case "queued":
      return "В очереди";
    case "published":
      return "Опубликован";
    case "failed":
      return "Ошибка";
    case "skipped":
      return "Пропуск";
    default:
      return s;
  }
}

function campaignListTitle(c: CampaignListRow): string {
  const t = c.title?.trim();
  if (t) return t;
  const d = new Date(c.createdAt);
  return `Кампания · ${d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}`;
}

function countMediaLines(lines: string): number {
  return lines
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

type CampaignMediaKind = "image" | "video" | "audio";

function inferCampaignMediaKindFromUrl(url: string): CampaignMediaKind {
  if (/\.(mp4|webm|mov|m4v|3gp)(\?|$)/i.test(url)) return "video";
  if (/\.(mp3|m4a|aac|wav|ogg)(\?|$)/i.test(url)) return "audio";
  return "image";
}

function probeVideoDurationSec(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const done = (sec: number | null) => {
      URL.revokeObjectURL(objectUrl);
      v.removeAttribute("src");
      v.load();
      resolve(sec);
    };
    v.onloadedmetadata = () => {
      const d = v.duration;
      done(Number.isFinite(d) && d > 0 ? d : null);
    };
    v.onerror = () => done(null);
    v.src = objectUrl;
  });
}

function QueueMediaThumb({ url }: { url: string }) {
  const kind = inferCampaignMediaKindFromUrl(url);
  if (kind === "audio") {
    return (
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        aria-hidden
      >
        <Music2 className="h-6 w-6" />
      </div>
    );
  }
  if (kind === "video") {
    return (
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-black">
        <video
          src={url}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
          aria-hidden
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
          <Play className="h-6 w-6 text-white drop-shadow" fill="currentColor" aria-hidden />
        </span>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="h-14 w-14 shrink-0 rounded-md object-cover bg-muted"
      loading="lazy"
    />
  );
}

export function CampaignsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoTrimResolverRef = useRef<((t: PostVideoTrimUpload | null) => void) | null>(null);
  const [videoTrimFile, setVideoTrimFile] = useState<File | null>(null);
  const [schedulePopoverOpen, setSchedulePopoverOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newCampaignTitle, setNewCampaignTitle] = useState("");
  const [titleEdit, setTitleEdit] = useState("");
  const [authorId, setAuthorId] = useState<string>("");
  const [bodyText, setBodyText] = useState("");
  const [mediaLines, setMediaLines] = useState("");
  /** Локальная дата/время публикации; null — без расписания (как только дойдёт очередь). */
  const [scheduleAt, setScheduleAt] = useState<Date | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const listQuery = useQuery({
    queryKey: QK_CAMPAIGNS,
    queryFn: fetchMediaStudioCampaigns,
  });

  const usersQuery = useQuery({
    queryKey: ["admin", "media-studio", "synthetic-users", "for-campaigns"],
    queryFn: () => fetchStudioSyntheticUsers(200, 0),
  });

  const detailQuery = useQuery({
    queryKey: ["admin", "media-studio", "campaign", selectedId],
    queryFn: () => fetchMediaStudioCampaignDetail(selectedId!),
    enabled: Boolean(selectedId),
  });

  const campaigns = (listQuery.data?.campaigns ?? []) as CampaignListRow[];

  useEffect(() => {
    if (!listQuery.isSuccess || campaigns.length === 0) return;
    if (selectedId && campaigns.some((c) => c.id === selectedId)) return;
    let restored: string | null = null;
    try {
      const raw = sessionStorage.getItem(SS_SELECTED);
      if (raw && campaigns.some((c) => c.id === raw)) restored = raw;
    } catch {
      /* ignore */
    }
    setSelectedId(restored ?? campaigns[0]!.id);
  }, [listQuery.isSuccess, campaigns, selectedId]);

  const selectCampaign = useCallback((id: string) => {
    setSelectedId(id);
    try {
      sessionStorage.setItem(SS_SELECTED, id);
    } catch {
      /* ignore */
    }
  }, []);

  const createMut = useMutation({
    mutationFn: (title?: string | null) =>
      createMediaStudioCampaign({
        title: title?.trim() ? title.trim().slice(0, 200) : null,
      }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: QK_CAMPAIGNS });
      selectCampaign(data.campaign.id);
      setCreateOpen(false);
      setNewCampaignTitle("");
      toast({ title: "Кампания создана", description: "Добавьте посты и запустите, когда будете готовы." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Ошибка", description: e.message }),
  });

  const patchMut = useMutation({
    mutationFn: (v: { id: string; status?: MediaStudioCampaign["status"]; title?: string | null }) =>
      patchMediaStudioCampaign(v.id, { status: v.status, title: v.title }),
    onSuccess: async (_, v) => {
      await qc.invalidateQueries({ queryKey: QK_CAMPAIGNS });
      await qc.invalidateQueries({ queryKey: ["admin", "media-studio", "campaign", v.id] });
      toast({ title: "Сохранено" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Ошибка", description: e.message }),
  });

  const campaign = detailQuery.data?.campaign;
  const posts = detailQuery.data?.posts ?? [];

  useEffect(() => {
    if (!campaign) return;
    setTitleEdit(campaign.title ?? "");
  }, [campaign?.id, campaign?.title]);

  const addPostMut = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error("Выберите кампанию");
      const urls = mediaLines
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);
      const scheduledAt = scheduleAt && !Number.isNaN(scheduleAt.getTime()) ? scheduleAt.toISOString() : null;
      return addMediaStudioCampaignPost(selectedId, {
        authorUserId: authorId,
        bodyText: bodyText.trim(),
        mediaUrls: urls,
        scheduledAt,
      });
    },
    onSuccess: async () => {
      if (selectedId) await qc.invalidateQueries({ queryKey: ["admin", "media-studio", "campaign", selectedId] });
      await qc.invalidateQueries({ queryKey: QK_CAMPAIGNS });
      setBodyText("");
      setMediaLines("");
      setScheduleAt(null);
      toast({ title: "Добавлено в очередь" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Ошибка", description: e.message }),
  });

  const delPostMut = useMutation({
    mutationFn: ({ campaignId, postId }: { campaignId: string; postId: string }) =>
      deleteMediaStudioCampaignPost(campaignId, postId),
    onSuccess: async (_, v) => {
      await qc.invalidateQueries({ queryKey: ["admin", "media-studio", "campaign", v.campaignId] });
      await qc.invalidateQueries({ queryKey: QK_CAMPAIGNS });
      toast({ title: "Удалено из очереди" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Ошибка", description: e.message }),
  });

  const tickMut = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error("Выберите кампанию");
      return tickMediaStudioCampaign(selectedId);
    },
    onSuccess: async (r) => {
      if (selectedId) await qc.invalidateQueries({ queryKey: ["admin", "media-studio", "campaign", selectedId] });
      await qc.invalidateQueries({ queryKey: QK_CAMPAIGNS });
      toast({
        title: "Очередь обработана",
        description: `Опубликовано: ${r.published}, ошибок: ${r.failed}`,
      });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Ошибка", description: e.message }),
  });

  const studioUsers = usersQuery.data?.users ?? [];

  const authorOptions = useMemo(
    () =>
      studioUsers.map((u) => ({
        id: u.id,
        label: [u.displayName, u.surname].filter(Boolean).join(" ") || `id ${u.id.slice(0, 8)}…`,
      })),
    [studioUsers],
  );

  const authorNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of authorOptions) m.set(o.id, o.label);
    return m;
  }, [authorOptions]);

  const postStats = useMemo(() => {
    let q = 0;
    let ok = 0;
    let bad = 0;
    for (const p of posts) {
      if (p.state === "queued") q += 1;
      else if (p.state === "published") ok += 1;
      else if (p.state === "failed" || p.state === "skipped") bad += 1;
    }
    return { q, ok, bad, total: posts.length };
  }, [posts]);

  const appendMediaUrl = useCallback((url: string) => {
    const u = url.trim();
    if (!u) return;
    setMediaLines((prev) => {
      const existing = prev
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (existing.includes(u)) return prev;
      const next = [...existing, u].slice(0, 10);
      return next.join("\n");
    });
  }, []);

  const requestVideoTrim = useCallback(
    (file: File) =>
      new Promise<PostVideoTrimUpload | null>((resolve) => {
        videoTrimResolverRef.current = resolve;
        setVideoTrimFile(file);
      }),
    [],
  );

  const handleVideoTrimOpenChange = useCallback((open: boolean) => {
    if (!open) {
      if (videoTrimResolverRef.current) {
        videoTrimResolverRef.current(null);
        videoTrimResolverRef.current = null;
      }
      setVideoTrimFile(null);
    }
  }, []);

  const handleVideoTrimConfirm = useCallback((trim: PostVideoTrimUpload) => {
    const r = videoTrimResolverRef.current;
    videoTrimResolverRef.current = null;
    r?.(trim);
    setVideoTrimFile(null);
  }, []);

  const onPickFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const current = countMediaLines(mediaLines);
      const room = Math.max(0, 10 - current);
      if (room <= 0) {
        toast({ variant: "destructive", title: "Лимит", description: "Уже 10 URL медиа — удалите лишние строки." });
        return;
      }
      setUploadBusy(true);
      let done = 0;
      try {
        for (const file of Array.from(files)) {
          if (done >= room) break;
          try {
            let url: string;
            if (file.type.startsWith("image/")) {
              url = await uploadPostMediaImageResized(file);
            } else if (file.type.startsWith("video/")) {
              const durationSec = await probeVideoDurationSec(file);
              if (durationSec == null) {
                toast({
                  variant: "destructive",
                  title: "Видео",
                  description: "Не удалось прочитать длительность. Попробуйте другой файл или конвертируйте в MP4.",
                });
                continue;
              }
              if (durationSec > POST_VIDEO_MAX_SECONDS + 0.05) {
                const trim = await requestVideoTrim(file);
                if (!trim) {
                  toast({ title: "Видео не добавлено", description: "Окно обрезки закрыто без подтверждения." });
                  continue;
                }
                url = await uploadPostMedia(file, trim);
              } else {
                url = await uploadPostMedia(file);
              }
            } else {
              url = await uploadPostMedia(file);
            }
            appendMediaUrl(url);
            done += 1;
          } catch (e) {
            toast({
              variant: "destructive",
              title: "Загрузка",
              description: e instanceof Error ? e.message : "Не удалось загрузить файл",
            });
          }
        }
        if (done > 0) {
          toast({ title: "Файлы загружены", description: `Добавлено ссылок: ${done}` });
        }
      } finally {
        setUploadBusy(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [appendMediaUrl, mediaLines, requestVideoTrim, toast],
  );

  if (listQuery.isError) {
    return (
      <ErrorWithRetry
        title="Не удалось загрузить кампании"
        description={(listQuery.error as Error)?.message ?? "Повторите запрос"}
        onRetry={() => void listQuery.refetch()}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Новая кампания</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="ms-new-campaign-title">Название (по желанию)</Label>
            <Input
              id="ms-new-campaign-title"
              value={newCampaignTitle}
              onChange={(e) => setNewCampaignTitle(e.target.value)}
              placeholder="Например: Запуск весны"
              maxLength={200}
              className="min-h-[var(--uix-touch-min)]"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={createMut.isPending}
              onClick={() => createMut.mutate(newCampaignTitle.trim() || null)}
            >
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminPanelCard className="p-4 sm:p-5 h-fit">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-foreground/90">Кампании</h2>
          <TapScaleButton
            type="button"
            haptic
            className="min-h-[var(--uix-touch-min)] rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            onClick={() => setCreateOpen(true)}
          >
            Новая
          </TapScaleButton>
        </div>
        {listQuery.isLoading ? (
          <div className={cn("space-y-2", adminSkeletonClass)}>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : campaigns.length === 0 ? (
          <ListEmptyState
            icon={LayoutGrid}
            title="Нет кампаний"
            description="Создайте кампанию, добавьте посты, выберите синтетического автора и запустите. Пока кампания «Идёт», сервер сам проверяет очередь примерно раз в минуту; дополнительно — воркер ленты (npm run dev:feed-worker). Мгновенно — кнопка «Обработать сейчас»."
            actionLabel="Создать кампанию"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <ul className="space-y-1">
            {campaigns.map((c) => {
              const nQueued = c.queuedCount ?? 0;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectCampaign(c.id)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors min-h-[var(--uix-touch-min)]",
                      selectedId === c.id
                        ? "bg-[hsl(var(--admin-accent)/0.25)] text-foreground"
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="block truncate font-medium min-w-0">{campaignListTitle(c)}</span>
                      {nQueued > 0 ? (
                        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {nQueued}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs opacity-80">{statusLabel(c.status)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </AdminPanelCard>

      <div className="min-w-0 space-y-4">
        {!selectedId ? (
          <AdminPanelCard className="p-6">
            <p className="text-sm text-muted-foreground">
              Выберите кампанию слева или создайте новую. Посты публикуются от имени пользователей из вкладки «Пользователи»
              (только синтетические аккаунты).
            </p>
          </AdminPanelCard>
        ) : detailQuery.isLoading ? (
          <AdminPanelCard className={cn("p-6", adminSkeletonClass)}>
            <Skeleton className="h-8 w-2/3 mb-4" />
            <Skeleton className="h-32 w-full" />
          </AdminPanelCard>
        ) : detailQuery.isError ? (
          <ErrorWithRetry
            title="Ошибка загрузки"
            description={(detailQuery.error as Error)?.message}
            onRetry={() => void detailQuery.refetch()}
          />
        ) : campaign ? (
          <>
            <AdminPanelCard className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                  В очереди: <strong className="text-foreground">{postStats.q}</strong>
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                  В ленте: <strong className="text-foreground">{postStats.ok}</strong>
                </span>
                {(postStats.bad > 0 || postStats.total > 0) && (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                    Ошибки / пропуски: <strong className="text-foreground">{postStats.bad}</strong>
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ms-campaign-title">Название кампании</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="ms-campaign-title"
                    value={titleEdit}
                    onChange={(e) => setTitleEdit(e.target.value)}
                    maxLength={200}
                    placeholder="Как называем в списке слева"
                    className="min-h-[var(--uix-touch-min)] flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-[var(--uix-touch-min)] shrink-0"
                    disabled={
                      patchMut.isPending || titleEdit.trim() === (campaign.title ?? "").trim()
                    }
                    onClick={() =>
                      patchMut.mutate({
                        id: campaign.id,
                        title: titleEdit.trim() ? titleEdit.trim().slice(0, 200) : null,
                      })
                    }
                  >
                    Сохранить название
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-start gap-4 justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">ID</p>
                  <p className="font-mono text-xs break-all opacity-80">{campaign.id}</p>
                  <p className="text-sm mt-2">
                    Статус: <strong>{statusLabel(campaign.status)}</strong>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {campaign.status === "draft" && (
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1"
                      disabled={patchMut.isPending}
                      onClick={() => patchMut.mutate({ id: campaign.id, status: "running" })}
                    >
                      <Play className="h-3.5 w-3.5" /> Запустить
                    </Button>
                  )}
                  {campaign.status === "running" && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        disabled={patchMut.isPending}
                        onClick={() => patchMut.mutate({ id: campaign.id, status: "paused" })}
                      >
                        <Pause className="h-3.5 w-3.5" /> Пауза
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1"
                        disabled={tickMut.isPending}
                        onClick={() => tickMut.mutate()}
                      >
                        {tickMut.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Zap className="h-3.5 w-3.5" />
                        )}
                        Обработать сейчас
                      </Button>
                    </>
                  )}
                  {campaign.status === "paused" && (
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1"
                      disabled={patchMut.isPending}
                      onClick={() => patchMut.mutate({ id: campaign.id, status: "running" })}
                    >
                      <Play className="h-3.5 w-3.5" /> Продолжить
                    </Button>
                  )}
                  {(campaign.status === "completed" || campaign.status === "cancelled") && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={patchMut.isPending}
                      onClick={() => patchMut.mutate({ id: campaign.id, status: "draft" })}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> В черновик
                    </Button>
                  )}
                  {(campaign.status === "draft" ||
                    campaign.status === "running" ||
                    campaign.status === "paused") && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="gap-1"
                      disabled={patchMut.isPending}
                      onClick={() => patchMut.mutate({ id: campaign.id, status: "cancelled" })}
                    >
                      <Ban className="h-3.5 w-3.5" /> Отменить
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Пока статус «Идёт», основной сервер примерно раз в минуту публикует элементы, у которых наступило запланированное
                время (или без даты — по порядку очереди). Процесс feed-worker делает то же при своём тике. «Обработать сейчас»
                — без ожидания. Если ждёте дольше минуты после времени публикации, проверьте логи сервера и что кампания не на
                паузе.
              </p>
            </AdminPanelCard>

            <AdminPanelCard className="p-4 sm:p-6 space-y-4">
              <h3 className="text-sm font-semibold">Добавить в очередь</h3>
              {usersQuery.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : authorOptions.length === 0 ? (
                <p className="text-sm text-destructive/90">
                  Нет синтетических пользователей. Создайте их на вкладке «Пользователи».
                </p>
              ) : (
                <div className="space-y-2">
                  <Label>Автор поста (studio user)</Label>
                  <Select value={authorId || undefined} onValueChange={setAuthorId}>
                    <SelectTrigger className="min-h-[var(--uix-touch-min)]">
                      <SelectValue placeholder="Кто публикует" />
                    </SelectTrigger>
                    <SelectContent>
                      {authorOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Текст поста</Label>
                <Textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={4}
                  className="min-h-[100px] resize-y"
                  placeholder="Текст в ленту…"
                />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Медиа — до 10 URL (или загрузите файлы)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime,audio/*"
                    multiple
                    onChange={(e) => void onPickFiles(e.target.files)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 min-h-[var(--uix-touch-min)]"
                    disabled={uploadBusy || countMediaLines(mediaLines) >= 10}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Загрузить файлы
                  </Button>
                </div>
                <Textarea
                  value={mediaLines}
                  onChange={(e) => setMediaLines(e.target.value)}
                  rows={3}
                  className="font-mono text-xs"
                  placeholder="https://… (новая строка или запятая)"
                />
                <p className="text-[11px] text-muted-foreground">
                  Файлы уходят в то же хранилище, что и посты в приложении (сессия админа). В ленте пост всё равно от имени
                  выбранного синтетического автора.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Запланировать публикацию (необязательно)</Label>
                <Popover open={schedulePopoverOpen} onOpenChange={setSchedulePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-[var(--uix-touch-min)] w-full max-w-md justify-start text-left font-normal"
                    >
                      <CalendarDays className="mr-2 h-4 w-4 shrink-0 opacity-70" aria-hidden />
                      {scheduleAt
                        ? scheduleAt.toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Без даты — по очереди"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="flex flex-col gap-3 p-3 sm:flex-row">
                      <Calendar
                        mode="single"
                        selected={scheduleAt ?? undefined}
                        onSelect={(d) => {
                          if (!d) return;
                          setScheduleAt((prev) => {
                            const next = new Date(d);
                            if (prev) {
                              next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
                            } else {
                              next.setHours(12, 0, 0, 0);
                            }
                            return next;
                          });
                        }}
                        captionLayout="dropdown"
                        startMonth={new Date(new Date().getFullYear() - 1, 0)}
                        endMonth={new Date(new Date().getFullYear() + 5, 11)}
                        defaultMonth={scheduleAt ?? new Date()}
                        className="rounded-md border-0"
                      />
                      <div className="flex min-w-[148px] flex-col gap-2 border-t border-border pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
                        <p className="text-xs font-medium text-muted-foreground">Время</p>
                        <div className="flex items-center gap-2">
                          <Select
                            value={String(scheduleAt?.getHours() ?? 12)}
                            onValueChange={(v) => {
                              const hour = Number.parseInt(v, 10);
                              const minute = scheduleAt?.getMinutes() ?? 0;
                              setScheduleAt((prev) => {
                                const base = prev ?? new Date();
                                const next = new Date(base);
                                next.setHours(hour, minute, 0, 0);
                                return next;
                              });
                            }}
                          >
                            <SelectTrigger className="h-9 min-h-[var(--uix-touch-min)]" aria-label="Час">
                              <SelectValue placeholder="Час" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[min(280px,50vh)]">
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={String(i)}>
                                  {String(i).padStart(2, "0")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-muted-foreground">:</span>
                          <Select
                            value={String(scheduleAt?.getMinutes() ?? 0)}
                            onValueChange={(v) => {
                              const minute = Number.parseInt(v, 10);
                              const hour = scheduleAt?.getHours() ?? 12;
                              setScheduleAt((prev) => {
                                const base = prev ?? new Date();
                                const next = new Date(base);
                                next.setHours(hour, minute, 0, 0);
                                return next;
                              });
                            }}
                          >
                            <SelectTrigger className="h-9 min-h-[var(--uix-touch-min)]" aria-label="Минуты">
                              <SelectValue placeholder="Мин" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[min(280px,50vh)]">
                              {Array.from({ length: 60 }, (_, i) => (
                                <SelectItem key={i} value={String(i)}>
                                  {String(i).padStart(2, "0")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            setScheduleAt(null);
                            setSchedulePopoverOpen(false);
                          }}
                        >
                          Без расписания
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <p className="text-[11px] text-muted-foreground">
                  Дата в календаре, время — списками. Часовой пояс браузера.
                </p>
              </div>
              <Button
                type="button"
                disabled={
                  addPostMut.isPending ||
                  !authorId ||
                  (!bodyText.trim() && countMediaLines(mediaLines) === 0)
                }
                onClick={() => addPostMut.mutate()}
              >
                {addPostMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "В очередь"}
              </Button>
            </AdminPanelCard>

            <AdminPanelCard className="p-4 sm:p-6 overflow-x-auto">
              <h3 className="text-sm font-semibold mb-3">Очередь и результат</h3>
              {posts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Пока пусто</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[88px]">Превью</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Автор</TableHead>
                      <TableHead>Текст</TableHead>
                      <TableHead>Когда</TableHead>
                      <TableHead>Пост</TableHead>
                      <TableHead className="w-[72px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="align-middle">
                          {p.mediaUrls?.length ? (
                            <QueueMediaThumb url={p.mediaUrls[0]} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{postStateLabel(p.state)}</TableCell>
                        <TableCell className="text-sm max-w-[140px] truncate">
                          {p.authorUserId ? (authorNameById.get(p.authorUserId) ?? p.authorUserId.slice(0, 8)) : "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{p.bodyText || "—"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {p.scheduledAt
                            ? new Date(p.scheduledAt).toLocaleString()
                            : p.state === "queued"
                              ? "сразу"
                              : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.publishedPath ? (
                            <a
                              href={p.publishedPath}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                            >
                              Открыть
                              <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {p.state === "queued" ? (
                            <TapScaleButton
                              type="button"
                              haptic
                              subtle
                              className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] p-1 text-destructive"
                              aria-label="Удалить из очереди"
                              disabled={delPostMut.isPending}
                              onClick={() =>
                                delPostMut.mutate({ campaignId: campaign.id, postId: p.id })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </TapScaleButton>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </AdminPanelCard>
          </>
        ) : null}
      </div>

      <PostVideoTrimmerModal
        open={!!videoTrimFile}
        file={videoTrimFile}
        onOpenChange={handleVideoTrimOpenChange}
        onConfirm={handleVideoTrimConfirm}
        maxSegmentSeconds={POST_VIDEO_MAX_SECONDS}
        title="Видео длиннее 14 с"
        description="Выберите фрагмент до 14 секунд — так же, как при публикации поста в ленте."
      />
    </div>
  );
}
