import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  Tag,
  ChevronRight,
  Sparkles,
  ImagePlus,
  Video,
  X,
  Check,
  Globe,
  Lock,
  Users,
  Hash,
  AtSign,
} from "lucide-react";
import { UploadProgressMediaTileOverlay, UploadProgressPanel } from "@/components/ui/upload-progress-panel";
import { resolveUrl } from "@/lib/api-base";
import { PostMedia } from "@/components/PostMedia";
import { EdgeCompanionFeedCard } from "@/features/edge-companion/components/EdgeCompanionFeedCard";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { useToast } from "@/hooks/use-toast";
import type { PostMediaLayout } from "@shared/post-media-layout";
import { extractMentions, MAX_POST_MENTIONS } from "@shared/schema/posts";
import type { PushTtlValue } from "@shared/schema/push-feed";
import { describePushAudience } from "@/features/push/push-audience-copy";
import { usePulseProfileThemeFromDocument } from "@/features/profile/pulse-profile/usePulseProfileThemeFromDocument";
import { listContactsWithProfiles, type ContactUser } from "@/lib/users";
import { UserAvatar } from "@/components/UserAvatar";
import { MotionBottomSheetPanel, MotionBottomSheetScrollArea } from "@/components/ui/motion-bottom-sheet";
import { Switch } from "@/components/ui/switch";
import {
  DURATION_NORMAL_S,
  EASING_OUT_BEZIER,
  usePrefersReducedMotion,
} from "@/lib/motion";

const IG_GRAD = "linear-gradient(135deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)";
const PUSH_TTL_OPTIONS: Array<{ value: PushTtlValue; label: string }> = [
  { value: "12h", label: "12ч" },
  { value: "24h", label: "24ч" },
  { value: "48h", label: "48ч" },
  { value: "56h", label: "56ч" },
  { value: "forever", label: "Бессрочно" },
];
const PUSH_TTL_ROW1 = PUSH_TTL_OPTIONS.slice(0, 3);
const PUSH_TTL_ROW2 = PUSH_TTL_OPTIONS.slice(3);

/** Мобильный редактор поста: поле подписи растёт с текстом (как в Instagram), затем скролл внутри поля. */
const CAPTION_TEXTAREA_MIN_PX = 90;
const CAPTION_TEXTAREA_MAX_VH = 0.42;
const CAPTION_TEXTAREA_MAX_CAP_PX = 320;

function captionTextareaMaxHeightPx(): number {
  if (typeof window === "undefined") return CAPTION_TEXTAREA_MAX_CAP_PX;
  return Math.min(Math.round(window.innerHeight * CAPTION_TEXTAREA_MAX_VH), CAPTION_TEXTAREA_MAX_CAP_PX);
}

const PULSE_T = {
  dark: {
    bg: "#080810",
    surface: "rgba(255,255,255,0.05)",
    surfaceHi: "rgba(255,255,255,0.08)",
    border: "rgba(255,255,255,0.09)",
    text: "rgba(255,255,255,0.92)",
    textSub: "rgba(255,255,255,0.52)",
    textFaint: "rgba(255,255,255,0.28)",
    accent: "#818cf8",
    accentDim: "rgba(129,140,248,0.12)",
    accentBrd: "rgba(129,140,248,0.30)",
    divider: "rgba(255,255,255,0.07)",
    gapRing: "#080810",
    cardBg: "rgba(255,255,255,0.05)",
    cardBorder: "rgba(255,255,255,0.08)",
  },
  light: {
    bg: "#eef1fb",
    surface: "rgba(255,255,255,0.85)",
    surfaceHi: "rgba(255,255,255,0.95)",
    border: "rgba(99,102,241,0.11)",
    text: "rgba(12,12,40,0.92)",
    textSub: "rgba(12,12,40,0.52)",
    textFaint: "rgba(12,12,40,0.28)",
    accent: "#6366f1",
    accentDim: "rgba(99,102,241,0.10)",
    accentBrd: "rgba(99,102,241,0.28)",
    divider: "rgba(99,102,241,0.09)",
    gapRing: "#eef1fb",
    cardBg: "rgba(255,255,255,0.70)",
    cardBorder: "rgba(99,102,241,0.12)",
  },
} as const;

type PulseThemeTokens = (typeof PULSE_T)["dark"] | (typeof PULSE_T)["light"];

type MediaKind = "image" | "video" | "audio";

export type PulseMobileMediaSlot =
  | { type: "done"; url: string; kind: MediaKind; aspectRatio?: number | null }
  | {
      type: "uploading";
      preview: string;
      id: number;
      kind: MediaKind;
      aspectRatio?: number | null;
      progress?: number;
    };

function initialsFromDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function PremiumOverlay() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.08) 40%, transparent 65%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(180,100,20,0.18) 0%, transparent 45%, rgba(30,80,120,0.12) 100%)",
          mixBlendMode: "color",
        }}
      />
    </>
  );
}

function AudienceChip({ th }: { th: PulseThemeTokens }) {
  const [idx, setIdx] = useState(0);
  const opts = [
    { icon: <Globe size={11} />, label: "Все" },
    { icon: <Users size={11} />, label: "Друзья" },
    { icon: <Lock size={11} />, label: "Только я" },
  ];
  const cur = opts[idx];
  return (
    <button
      type="button"
      onClick={() => setIdx((i) => (i + 1) % 3)}
      className="flex items-center gap-1 rounded-full px-2 py-0.5"
      style={{ background: th.accentDim, border: `1px solid ${th.accentBrd}` }}
    >
      <span style={{ color: th.accent }}>{cur.icon}</span>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: th.accent }}>{cur.label}</span>
    </button>
  );
}

export type CreatePostPulseMobileProps = {
  onBack: () => void;
  displayName: string;
  handleLine: string;
  avatarUrl?: string | null;
  showVerified?: boolean;
  text: string;
  setText: (v: string) => void;
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
  maxChars: number;
  mediaItems: PulseMobileMediaSlot[];
  mediaUrls: string[];
  previewLayout: PostMediaLayout | null;
  hasUploading: boolean;
  onRemoveMedia: (index: number) => void;
  canPublish: boolean;
  isPublishing: boolean;
  onPublish: () => void;
  isProofreading: boolean;
  onProofread: () => void;
  error: string;
  availableSlots: number;
  isNativePlatform: boolean;
  onNativePickPhoto: () => void;
  onOpenMediaPicker: () => void;
  imageInputRef: RefObject<HTMLInputElement | null>;
  videoInputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Режим редактирования существующего поста */
  headerTitle?: string;
  publishButtonLabel?: string;
  publishingButtonLabel?: string;
  isEditMode?: boolean;
  /** Пост с кампанией EDGE: превью блока как в ленте (сверху, до вложений). */
  edgeCampaignId?: string;
  edgePreviewViewerId?: string | number;
  showLinkEmbedRow?: boolean;
  linkEmbedEnabled?: boolean;
  setLinkEmbedEnabled?: (v: boolean) => void;
  sendToPush?: boolean;
  setSendToPush?: (v: boolean) => void;
  pushTtl?: PushTtlValue;
  setPushTtl?: (v: PushTtlValue) => void;
  pushQuotaRemaining?: number;
  pushQuotaMax?: number;
  pushSubscribersInFeed?: number;
  pushNotifyRecipients?: number;
};

export function CreatePostPulseMobile({
  onBack,
  displayName,
  handleLine,
  avatarUrl,
  showVerified,
  text,
  setText,
  textAreaRef,
  maxChars,
  mediaItems,
  mediaUrls,
  previewLayout,
  hasUploading,
  onRemoveMedia,
  canPublish,
  isPublishing,
  onPublish,
  isProofreading,
  onProofread,
  error,
  availableSlots,
  isNativePlatform,
  onNativePickPhoto,
  onOpenMediaPicker,
  imageInputRef,
  videoInputRef,
  onFileChange,
  headerTitle = "Новый пост",
  publishButtonLabel = "Поделиться",
  publishingButtonLabel = "Публикуем…",
  isEditMode = false,
  edgeCampaignId,
  edgePreviewViewerId = "guest",
  showLinkEmbedRow = false,
  linkEmbedEnabled = true,
  setLinkEmbedEnabled,
  sendToPush = false,
  setSendToPush,
  pushTtl = "24h",
  setPushTtl,
  pushQuotaRemaining = 3,
  pushQuotaMax = 3,
  pushSubscribersInFeed = 0,
  pushNotifyRecipients = 0,
}: CreatePostPulseMobileProps) {
  const docTheme = usePulseProfileThemeFromDocument();
  const isDark = docTheme === "dark";
  const th = isDark ? PULSE_T.dark : PULSE_T.light;
  const { toast } = useToast();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [showMentionSheet, setShowMentionSheet] = useState(false);
  const { data: mentionContacts = [], isFetching: mentionContactsLoading } = useQuery({
    queryKey: ["contacts", "profiles", "mention-picker"],
    queryFn: listContactsWithProfiles,
    staleTime: 60_000,
    enabled: showMentionSheet,
  });
  const initials = initialsFromDisplayName(displayName || "?");
  const resolvedAvatar = avatarUrl?.trim() ? resolveUrl(avatarUrl.trim()) : "";

  const mediaEmpty = mediaItems.length === 0;
  const allDone = mediaItems.length > 0 && mediaItems.every((s) => s.type === "done");

  const [aiFlash, setAiFlash] = useState(false);
  const aiFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevProofreading = useRef(isProofreading);
  const editorScrollRef = useRef<HTMLDivElement>(null);

  const syncCaptionTextareaSize = useCallback(() => {
    const ta = textAreaRef.current;
    if (!ta) return;
    const maxH = captionTextareaMaxHeightPx();
    ta.style.height = "0px";
    const scrollH = ta.scrollHeight;
    const next = Math.max(CAPTION_TEXTAREA_MIN_PX, Math.min(scrollH, maxH));
    ta.style.height = `${next}px`;
    ta.style.overflowY = scrollH > maxH ? "auto" : "hidden";
  }, [textAreaRef]);

  useLayoutEffect(() => {
    syncCaptionTextareaSize();
    const ta = textAreaRef.current;
    const scrollEl = editorScrollRef.current;
    if (!ta || !scrollEl) return;
    const taRect = ta.getBoundingClientRect();
    const scRect = scrollEl.getBoundingClientRect();
    const margin = 28;
    if (taRect.bottom > scRect.bottom - margin) {
      scrollEl.scrollTop += taRect.bottom - scRect.bottom + margin;
    }
  }, [text, syncCaptionTextareaSize]);

  useEffect(() => {
    const ta = textAreaRef.current;
    if (!ta) return;
    let delayed: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      syncCaptionTextareaSize();
      ta.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    const onFocus = () => {
      requestAnimationFrame(run);
      if (delayed) clearTimeout(delayed);
      delayed = setTimeout(run, 280);
    };
    ta.addEventListener("focus", onFocus);
    return () => {
      ta.removeEventListener("focus", onFocus);
      if (delayed) clearTimeout(delayed);
    };
  }, [syncCaptionTextareaSize]);

  useEffect(() => {
    const onResize = () => syncCaptionTextareaSize();
    window.addEventListener("resize", onResize);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", onResize);
      vv.addEventListener("scroll", onResize);
    }
    return () => {
      window.removeEventListener("resize", onResize);
      if (vv) {
        vv.removeEventListener("resize", onResize);
        vv.removeEventListener("scroll", onResize);
      }
    };
  }, [syncCaptionTextareaSize]);

  useEffect(() => {
    if (prevProofreading.current && !isProofreading) {
      setAiFlash(true);
      if (aiFlashTimer.current) clearTimeout(aiFlashTimer.current);
      aiFlashTimer.current = setTimeout(() => setAiFlash(false), 2800);
    }
    prevProofreading.current = isProofreading;
    return () => {
      if (aiFlashTimer.current) clearTimeout(aiFlashTimer.current);
    };
  }, [isProofreading]);

  const doneCount = mediaItems.filter((s) => s.type === "done").length;

  const headerSubtitle = (() => {
    if (mediaEmpty && edgeCampaignId?.trim() && !isEditMode) return "Интерактив EDGE";
    if (mediaEmpty) return "Медиа не добавлено";
    if (hasUploading) return "Загрузка медиа…";
    const kinds = mediaItems.filter((s) => s.type === "done").map((s) => s.kind);
    const onlyImg = kinds.length && kinds.every((k) => k === "image");
    const onlyVid = kinds.length && kinds.every((k) => k === "video");
    const onlyAud = kinds.length && kinds.every((k) => k === "audio");
    if (onlyImg && kinds.length === 1) return "Фото";
    if (onlyVid && kinds.length === 1) return "Видео";
    if (onlyAud && kinds.length === 1) return "Аудио";
    return `${doneCount} медиа`;
  })();

  const charLeft = maxChars - text.length;
  const charPct = Math.min(text.length / maxChars, 1);

  const insertAtCursor = useCallback(
    (ch: string) => {
      const ta = textAreaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = `${text.slice(0, start)}${ch}${text.slice(end)}`.slice(0, maxChars);
      setText(next);
      requestAnimationFrame(() => {
        ta.focus();
        const p = Math.min(start + ch.length, next.length);
        ta.setSelectionRange(p, p);
      });
    },
    [text, maxChars, setText, textAreaRef],
  );

  const insertMentionByPublicId = useCallback(
    (publicId: number) => {
      const token = String(publicId);
      const tokens = extractMentions(text);
      if (tokens.length >= MAX_POST_MENTIONS) {
        toast({ title: `Не больше ${MAX_POST_MENTIONS} упоминаний (@) в посте`, variant: "destructive" });
        return;
      }
      if (tokens.includes(token)) {
        toast({ title: "Этот контакт уже отмечен в тексте" });
        return;
      }
      const insert = `@${token} `;
      const ta = textAreaRef.current;
      setShowMentionSheet(false);
      if (!ta) {
        setText(`${text}${insert}`.slice(0, maxChars));
        return;
      }
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = `${text.slice(0, start)}${insert}${text.slice(end)}`.slice(0, maxChars);
      setText(next);
      requestAnimationFrame(() => {
        ta.focus();
        const p = Math.min(start + insert.length, next.length);
        ta.setSelectionRange(p, p);
      });
    },
    [text, maxChars, setText, textAreaRef, toast],
  );

  const contactLine = (c: ContactUser) =>
    [c.displayName, c.surname].filter(Boolean).join(" ").trim() || `id${c.publicId}`;

  const triggerPhoto = () => {
    if (availableSlots <= 0) {
      toast({ title: "Достигнут лимит медиа", variant: "destructive" });
      return;
    }
    if (isNativePlatform) onNativePickPhoto();
    else imageInputRef.current?.click();
  };

  const triggerVideo = () => {
    if (availableSlots <= 0) {
      toast({ title: "Достигнут лимит медиа", variant: "destructive" });
      return;
    }
    if (isNativePlatform) onOpenMediaPicker();
    else videoInputRef.current?.click();
  };

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      style={{
        background: th.bg,
        fontFamily: "-apple-system,BlinkMacSystemFont,'Inter',sans-serif",
        color: th.text,
      }}
    >
      <style>{`
        @keyframes spinRingPulse { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeSlidePulse { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes checkPopPulse { 0% { transform: scale(0.4); opacity: 0; } 70% { transform: scale(1.2); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes pulseDot { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
        .ai-badge-pulse { animation: fadeSlidePulse 0.3s ease-out; }
        .check-pop-pulse { animation: checkPopPulse 0.35s cubic-bezier(.36,.07,.19,.97) both; }
        .thinking-dot-pulse { animation: pulseDot 1.2s ease-in-out infinite; }
      `}</style>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={onFileChange}
        aria-hidden
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*,.mp4,.mov,.webm,.m4v"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={onFileChange}
        aria-hidden
      />

      {/* HEADER */}
      <div className="flex shrink-0 items-center justify-between px-4 pb-2.5 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <TapScaleButton
          type="button"
          haptic
          subtle
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: th.surface }}
          aria-label="Назад"
        >
          <ChevronLeft style={{ width: 20, height: 20, color: th.text }} />
        </TapScaleButton>
        <div className="flex flex-col items-center">
          <span style={{ fontSize: 15, fontWeight: 800, color: th.text, lineHeight: 1 }}>{headerTitle}</span>
          <span style={{ fontSize: 10, color: th.textFaint, marginTop: 2, lineHeight: 1 }}>{headerSubtitle}</span>
        </div>
        <TapScaleButton
          type="button"
          haptic
          onClick={onPublish}
          disabled={!canPublish}
          className="rounded-xl px-4 py-1.5 transition-all disabled:opacity-45"
          style={{
            background: canPublish ? th.accent : th.surface,
            boxShadow: canPublish ? `0 2px 16px ${th.accent}55` : "none",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 800, color: canPublish ? "white" : th.textFaint }}>
            {isPublishing ? publishingButtonLabel : publishButtonLabel}
          </span>
        </TapScaleButton>
      </div>

      <div
        ref={editorScrollRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(var(--uix-nav-bottom)+var(--uix-space-3))] [scrollbar-width:none] [-webkit-overflow-scrolling:touch] overscroll-y-contain"
      >
        {edgeCampaignId?.trim() && !isEditMode ? (
          <div className="px-3 pb-3" style={{ borderBottom: `1px solid ${th.divider}` }}>
            <div className="mb-2 flex items-center gap-1.5 px-0.5">
              <Sparkles className="shrink-0" style={{ width: 14, height: 14, color: th.accent }} aria-hidden />
              <span className="text-[11px] font-bold leading-snug" style={{ color: th.textSub }}>
                В ленту так же: интерактив первым, фото и видео — ниже (по желанию)
              </span>
            </div>
            <EdgeCompanionFeedCard
              variant="feed"
              edgeId={edgeCampaignId.trim()}
              userId={edgePreviewViewerId}
              onOpen={() => {
                toast({ title: "После публикации откроется из ленты или профиля" });
              }}
            />
          </div>
        ) : null}

        {/* MEDIA */}
        <div style={{ borderBottom: `1px solid ${th.divider}`, paddingBottom: 12 }}>
          {mediaEmpty && (
            <div className="mx-3">
              <div
                className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl"
                style={{ height: 210, background: th.surface, border: `1.5px dashed ${th.border}` }}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: `radial-gradient(ellipse at 40% 40%, ${th.accent}0f 0%, transparent 70%)` }}
                />
                <div className="relative flex flex-col items-center gap-4">
                  <div className="flex gap-3">
                    <TapScaleButton
                      type="button"
                      haptic
                      onClick={triggerPhoto}
                      disabled={availableSlots <= 0}
                      className="flex flex-col items-center gap-2 rounded-2xl px-6 py-4 transition-all disabled:opacity-50"
                      style={{
                        background: `linear-gradient(135deg, ${th.accent}20, ${th.accent}0a)`,
                        border: `1.5px solid ${th.accentBrd}`,
                      }}
                    >
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-2xl"
                        style={{ background: `${th.accent}22`, boxShadow: `0 4px 16px ${th.accent}25` }}
                      >
                        <ImagePlus style={{ width: 22, height: 22, color: th.accent }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: th.accent }}>Фото</span>
                    </TapScaleButton>
                    <TapScaleButton
                      type="button"
                      haptic
                      onClick={triggerVideo}
                      disabled={availableSlots <= 0}
                      className="flex flex-col items-center gap-2 rounded-2xl px-6 py-4 transition-all disabled:opacity-50"
                      style={{ background: th.surface, border: `1.5px solid ${th.border}` }}
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: th.surfaceHi }}>
                        <Video style={{ width: 22, height: 22, color: th.textSub }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: th.textSub }}>Видео</span>
                    </TapScaleButton>
                  </div>
                  <span style={{ fontSize: 11, color: th.textFaint }}>Нажмите чтобы выбрать медиа</span>
                </div>
              </div>
            </div>
          )}

          {mediaItems.length > 0 && allDone && (
            <div className="mx-3">
              <div className="mb-2 flex items-center gap-1.5 px-0.5">
                <div className="flex-1" />
                {availableSlots > 0 && (
                  <TapScaleButton
                    type="button"
                    haptic
                    subtle
                    onClick={onOpenMediaPicker}
                    className="rounded-lg px-2.5 py-1"
                    style={{ background: th.accentDim, border: `1px solid ${th.accentBrd}` }}
                  >
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: th.accent }}>Ещё медиа</span>
                  </TapScaleButton>
                )}
              </div>
              {isEditMode && mediaItems.length > 1 ? (
                <p className="mb-2 px-0.5 text-[11px] leading-snug" style={{ color: th.textSub }}>
                  Чтобы заменить кадр: нажмите × на миниатюре, затем «Ещё медиа» и выберите новый файл.
                </p>
              ) : null}

              <div className="space-y-2">
                {mediaItems.length > 1 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {mediaItems.map((slot, i) => {
                      if (slot.type !== "done") return null;
                      const src = resolveUrl(slot.url);
                      return (
                        <div key={`strip-${i}-${slot.url}`} className="relative flex-shrink-0">
                          <div
                            className="h-14 w-14 overflow-hidden rounded-xl ring-1 ring-white/15"
                            style={{ background: th.surface }}
                          >
                            {slot.kind === "video" ? (
                              <video
                                src={src}
                                className="h-full w-full object-cover"
                                muted
                                playsInline
                                preload="auto"
                                onLoadedMetadata={(e) => {
                                  const v = e.currentTarget;
                                  try {
                                    if (v.readyState >= 1) v.currentTime = 0.001;
                                  } catch {
                                    /* ignore */
                                  }
                                }}
                              />
                            ) : slot.kind === "audio" ? (
                              <div className="flex h-full items-center justify-center text-[10px]" style={{ color: th.textFaint }}>
                                A
                              </div>
                            ) : (
                              <img src={src} alt="" className="h-full w-full object-cover" />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveMedia(i)}
                            className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white"
                            aria-label={`Удалить медиа ${i + 1}`}
                          >
                            <X style={{ width: 12, height: 12 }} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <div
                  className="relative overflow-hidden rounded-3xl"
                  style={{ background: "#06060e", border: `1px solid ${th.cardBorder}` }}
                >
                  <PostMedia
                    mediaUrls={mediaUrls}
                    layout={previewLayout}
                    className="!mt-0 [&_.rounded-2xl]:!rounded-2xl"
                    maxHeight="min(360px, 55vh)"
                  />
                  <PremiumOverlay />
                  <div
                    className="check-pop-pulse absolute left-2.5 top-2.5 z-[1] flex items-center gap-1 rounded-full px-2 py-0.5"
                    style={{ background: "rgba(34,197,94,0.82)", backdropFilter: "blur(8px)" }}
                  >
                    <Check style={{ width: 10, height: 10, color: "white", strokeWidth: 3 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: "white" }}>Готово</span>
                  </div>
                  {mediaItems.length === 1 ? (
                    <button
                      type="button"
                      onClick={() => onRemoveMedia(0)}
                      className="absolute right-2 top-2 z-[1] flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-lg"
                      style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.12)" }}
                      aria-label="Удалить медиа"
                    >
                      <X style={{ width: 14, height: 14, color: "white" }} />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {mediaItems.length > 0 && !allDone && (
            <div className="mx-3 grid grid-cols-2 gap-2">
              {mediaItems.map((slot, i) => {
                const src = slot.type === "done" ? resolveUrl(slot.url) : slot.preview;
                const uploading = slot.type === "uploading";
                const isVideo = slot.kind === "video";
                const isAudio = slot.kind === "audio";
                return (
                  <div
                    key={slot.type === "uploading" ? `u-${slot.id}` : `d-${i}`}
                    className="relative aspect-square overflow-hidden rounded-2xl ring-1 ring-white/10"
                    style={{ background: th.surface }}
                  >
                    {isAudio ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2">
                        <audio src={src} controls preload="metadata" className="w-full" />
                      </div>
                    ) : isVideo ? (
                      <video
                        src={src}
                        className="h-full w-full object-cover"
                        playsInline
                        muted
                        preload="auto"
                        onLoadedMetadata={(e) => {
                          const v = e.currentTarget;
                          try {
                            if (v.readyState >= 1) v.currentTime = 0.001;
                          } catch {
                            /* ignore */
                          }
                        }}
                      />
                    ) : (
                      <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-black/55 px-2">
                        <UploadProgressMediaTileOverlay
                          percent={slot.type === "uploading" ? slot.progress ?? null : null}
                          reducedMotion={prefersReducedMotion}
                          className="h-full w-full"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveMedia(i)}
                      className="absolute right-2 top-2 flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm"
                      aria-label={uploading ? "Отменить загрузку" : "Удалить"}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AUTHOR + TEXT */}
        <div className="px-3 pt-3">
          <div className="rounded-3xl p-3" style={{ background: th.cardBg, border: `1px solid ${th.cardBorder}` }}>
            <div className="mb-2.5 flex items-center gap-2.5">
              <div className="relative flex-shrink-0" style={{ width: 38, height: 38 }}>
                <div
                  className="absolute rounded-[12px]"
                  style={{ inset: -2, background: IG_GRAD, boxShadow: "0 0 8px rgba(214,41,118,0.35)" }}
                />
                <div className="absolute rounded-[10px]" style={{ inset: -0.5, background: th.gapRing }} />
                <div
                  className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-[11px] font-black text-xs"
                  style={{
                    background: isDark ? "linear-gradient(145deg,#1a1040,#0c0820)" : "linear-gradient(145deg,#d8d4f8,#eef1fb)",
                    color: th.accent,
                  }}
                >
                  {resolvedAvatar ? (
                    <img src={resolvedAvatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: th.text, lineHeight: 1 }}>{displayName || "Профиль"}</span>
                  {showVerified ? (
                    <div
                      className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ background: th.accent }}
                    >
                      <span style={{ fontSize: 8, color: "white", fontWeight: 900 }}>✓</span>
                    </div>
                  ) : null}
                </div>
                <span style={{ fontSize: 10.5, color: th.textFaint, lineHeight: 1, marginTop: 2, display: "block" }}>
                  {handleLine}
                </span>
              </div>
              <AudienceChip th={th} />
            </div>
            <textarea
              ref={textAreaRef}
              value={text}
              onChange={(e) => {
                setAiFlash(false);
                setText(e.target.value.slice(0, maxChars));
              }}
              placeholder="О чём ваш пост?…"
              aria-label="Текст поста"
              rows={1}
              spellCheck
              enterKeyHint="enter"
              className="box-border w-full resize-none overflow-hidden border-none bg-transparent outline-none"
              style={{
                minHeight: CAPTION_TEXTAREA_MIN_PX,
                maxHeight: captionTextareaMaxHeightPx(),
                fontSize: 14,
                lineHeight: 1.65,
                color: th.text,
                fontFamily: "inherit",
                WebkitOverflowScrolling: "touch",
              }}
              autoFocus
            />
            {showLinkEmbedRow && setLinkEmbedEnabled ? (
              <div
                className="mt-2 flex items-center justify-between gap-2 rounded-2xl px-2.5 py-1.5"
                style={{ background: th.surface, border: `1px solid ${th.border}` }}
              >
                <span className="text-[10px] font-medium leading-snug" style={{ color: th.textSub }}>
                  Превью по ссылке
                </span>
                <Switch
                  checked={linkEmbedEnabled}
                  onCheckedChange={setLinkEmbedEnabled}
                  aria-label="Превью видео по ссылке"
                  className="scale-90"
                />
              </div>
            ) : null}
            <div className="mt-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TapScaleButton
                  type="button"
                  haptic
                  subtle
                  className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: th.surface, color: th.textSub }}
                  aria-label="Вставить хэштег"
                  onClick={() => insertAtCursor("#")}
                >
                  <Hash size={14} />
                </TapScaleButton>
                <TapScaleButton
                  type="button"
                  haptic
                  subtle
                  className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: th.surface, color: th.textSub }}
                  aria-label="Отметить человека"
                  onClick={() => setShowMentionSheet(true)}
                >
                  <AtSign size={14} />
                </TapScaleButton>
              </div>
              <div className="relative flex items-center justify-center" style={{ width: 28, height: 28 }}>
                <svg width={28} height={28} className="absolute" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx={14} cy={14} r={11} fill="none" stroke={th.divider} strokeWidth={2.5} />
                  <circle
                    cx={14}
                    cy={14}
                    r={11}
                    fill="none"
                    stroke={charLeft < 200 ? "#ef4444" : charLeft < 800 ? "#f59e0b" : th.accent}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeDasharray={`${charPct * 2 * Math.PI * 11} ${2 * Math.PI * 11}`}
                  />
                </svg>
                {charLeft < 1200 && (
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 800,
                      color: charLeft < 200 ? "#ef4444" : "#f59e0b",
                      position: "relative",
                    }}
                  >
                    {charLeft > 999 ? `${Math.round(charLeft / 1000)}k` : charLeft}
                  </span>
                )}
              </div>
            </div>
            <p style={{ fontSize: 10, color: th.textFaint, marginTop: 6 }}>
              До {MAX_POST_MENTIONS} отметок @ — выбранные получат уведомление. Публичный id надёжнее ника.
            </p>
          </div>
        </div>

        {error ? (
          <p className="mt-2 px-4 text-[13px] leading-snug text-red-500">{error}</p>
        ) : null}

        {/* SETTINGS LIST */}
        <div className="mx-3 mt-2 overflow-hidden rounded-3xl" style={{ border: `1px solid ${th.cardBorder}` }}>
          <TapScaleButton
            type="button"
            haptic
            subtle
            onClick={() => setShowMentionSheet(true)}
            className="flex w-full items-center justify-between border-b px-4 py-3 transition-colors active:bg-white/5"
            style={{ borderColor: th.divider, background: th.cardBg }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl" style={{ background: th.surface, color: th.textFaint }}>
                <Tag size={14} />
              </div>
              <span style={{ fontSize: 13.5, color: th.textSub }}>Отметить людей</span>
            </div>
            <ChevronRight style={{ width: 15, height: 15, color: th.textFaint }} />
          </TapScaleButton>

          {/* AI Арифметика — вместо «Раздел профиля» */}
          <div
            className="flex w-full items-center justify-between gap-2 border-b px-4 py-3"
            style={{ borderColor: th.divider, background: th.cardBg }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              {isProofreading ? (
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: `2px solid ${th.accent}`,
                    borderTopColor: "transparent",
                    animation: "spinRingPulse 0.7s linear infinite",
                  }}
                />
              ) : aiFlash ? (
                <div className="check-pop-pulse flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "#22c55e" }}>
                  <Check style={{ width: 11, height: 11, color: "white", strokeWidth: 3 }} />
                </div>
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-lg" style={{ background: `${th.accent}25` }}>
                  <Sparkles style={{ width: 12, height: 12, color: th.accent }} />
                </div>
              )}
              <div className="flex min-w-0 flex-col items-start">
                <span style={{ fontSize: 13, fontWeight: 800, color: th.accent, letterSpacing: "-0.01em" }}>AI Арифметика</span>
                {!isProofreading && !aiFlash && (
                  <span style={{ fontSize: 10, color: th.textFaint, fontWeight: 500, lineHeight: 1, marginTop: 2 }}>
                    Орфография · Структура · Отступы
                  </span>
                )}
                {isProofreading && (
                  <div className="mt-1 flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="thinking-dot-pulse h-1 w-1 rounded-full"
                        style={{ background: th.accent, animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                )}
                {aiFlash && (
                  <span className="ai-badge-pulse mt-0.5" style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>
                    Текст улучшен
                  </span>
                )}
              </div>
            </div>
            {!isProofreading && !aiFlash && (
              <TapScaleButton
                type="button"
                haptic
                onClick={onProofread}
                disabled={!text.trim()}
                className="shrink-0 rounded-lg px-2.5 py-1 disabled:opacity-45"
                style={{ background: `${th.accent}22`, border: `1px solid ${th.accentBrd}` }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: th.accent }}>Запустить</span>
              </TapScaleButton>
            )}
          </div>
          {!isEditMode && setSendToPush ? (
            <div className="px-4 py-3" style={{ background: th.cardBg }}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: th.text }}>Отправить в Push</p>
                  <p style={{ fontSize: 11, color: th.textFaint }}>
                    Осталось {pushQuotaRemaining}/{pushQuotaMax} за 24 часа
                  </p>
                </div>
                <Switch
                  checked={sendToPush}
                  onCheckedChange={setSendToPush}
                  aria-label="Отправить пост в Push-ленту"
                />
              </div>
              {sendToPush && setPushTtl ? (
                <>
                  <p className="mt-1.5 text-[10px] leading-snug" style={{ color: th.textFaint }}>
                    {describePushAudience(pushSubscribersInFeed, pushNotifyRecipients).short}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {PUSH_TTL_ROW1.map((option) => (
                      <TapScaleButton
                        key={option.value}
                        type="button"
                        haptic
                        subtle
                        onClick={() => setPushTtl(option.value)}
                        className="flex min-h-[34px] w-full items-center justify-center whitespace-nowrap rounded-full px-1 text-[11px] font-bold"
                        style={{
                          background: pushTtl === option.value ? th.accentDim : th.surface,
                          border: `1px solid ${pushTtl === option.value ? th.accentBrd : th.border}`,
                        }}
                      >
                        <span style={{ color: pushTtl === option.value ? th.accent : th.textSub }}>{option.label}</span>
                      </TapScaleButton>
                    ))}
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {PUSH_TTL_ROW2.map((option) => (
                      <TapScaleButton
                        key={option.value}
                        type="button"
                        haptic
                        subtle
                        onClick={() => setPushTtl(option.value)}
                        className="flex min-h-[34px] w-full items-center justify-center whitespace-nowrap rounded-full px-1 text-[11px] font-bold"
                        style={{
                          background: pushTtl === option.value ? th.accentDim : th.surface,
                          border: `1px solid ${pushTtl === option.value ? th.accentBrd : th.border}`,
                        }}
                      >
                        <span style={{ color: pushTtl === option.value ? th.accent : th.textSub }}>{option.label}</span>
                      </TapScaleButton>
                    ))}
                  </div>
                </>
              ) : null}
              {sendToPush && pushQuotaRemaining <= 0 ? (
                <p className="mt-2 text-[11px] text-red-500">Лимит Push исчерпан: максимум {pushQuotaMax} за 24 часа.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {showMentionSheet && (
          <motion.div
            className="fixed inset-0 z-[200]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.05 : DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
          >
            <button
              type="button"
              className="absolute inset-0 z-0 bg-black/50"
              onClick={() => setShowMentionSheet(false)}
              aria-label="Закрыть"
            />
            <MotionBottomSheetPanel
              className="absolute inset-x-0 bottom-0 z-10 flex max-h-[min(72vh,520px)] min-h-0 flex-col rounded-t-[1.25rem] border-t shadow-2xl"
              style={{
                background: th.bg,
                borderColor: th.divider,
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: prefersReducedMotion ? 0.05 : DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
              disableSwipeDismiss={prefersReducedMotion}
              onDismiss={() => setShowMentionSheet(false)}
              dragHandle={
                <>
                  <div className="mx-auto mb-2 mt-2 h-1 w-10 shrink-0 rounded-full opacity-30" style={{ background: th.text }} aria-hidden />
                  <p className="shrink-0 px-4 pb-2 text-[13px] font-semibold" style={{ color: th.text }}>
                    Отметить человека
                  </p>
                  <p className="shrink-0 px-4 pb-2 text-[11px] leading-snug" style={{ color: th.textFaint }}>
                    В текст вставится отметка по публичному id (например @5) — сервер отправит уведомление (до {MAX_POST_MENTIONS}{" "}
                    разных @).
                  </p>
                </>
              }
            >
              <MotionBottomSheetScrollArea className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {mentionContactsLoading ? (
                  <p className="px-3 py-4 text-center text-[13px]" style={{ color: th.textSub }}>
                    Загрузка контактов…
                  </p>
                ) : mentionContacts.length === 0 ? (
                  <p className="px-3 py-4 text-center text-[13px]" style={{ color: th.textSub }}>
                    Нет контактов. Введите @ и публичный id или ник вручную.
                  </p>
                ) : (
                  mentionContacts.map((c) => (
                    <TapScaleButton
                      key={c.id}
                      type="button"
                      haptic
                      subtle
                      onClick={() => insertMentionByPublicId(c.publicId)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors active:bg-white/5"
                    >
                      <UserAvatar
                        avatarUrl={c.avatarUrl}
                        displayName={contactLine(c)}
                        seed={c.id}
                        size={40}
                        pointerEventsNone
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium" style={{ color: th.text }}>
                          {contactLine(c)}
                        </p>
                        <p className="text-[12px] tabular-nums" style={{ color: th.textFaint }}>
                          @{c.publicId}
                        </p>
                      </div>
                    </TapScaleButton>
                  ))
                )}
              </MotionBottomSheetScrollArea>
              <div className="shrink-0 border-t px-3 py-2" style={{ borderColor: th.divider }}>
                <TapScaleButton
                  type="button"
                  haptic
                  subtle
                  onClick={() => {
                    setShowMentionSheet(false);
                    insertAtCursor("@");
                  }}
                  className="w-full rounded-xl py-2.5 text-[14px] font-medium"
                  style={{ background: th.surface, color: th.textSub }}
                >
                  Только символ @
                </TapScaleButton>
              </div>
            </MotionBottomSheetPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {isPublishing ? (
        <div
          className="fixed inset-0 z-[240] flex items-center justify-center px-6"
          style={{ background: "rgba(0,0,0,0.48)" }}
          role="alertdialog"
          aria-busy="true"
          aria-live="polite"
          aria-label={publishingButtonLabel}
        >
          <div
            className="w-full max-w-xs rounded-2xl px-5 py-6 shadow-xl"
            style={{ background: th.cardBg, border: `1px solid ${th.cardBorder}` }}
          >
            <UploadProgressPanel
              title={publishingButtonLabel}
              percent={null}
              indeterminateHint="Публикация…"
              reducedMotion={prefersReducedMotion}
              size="md"
              showIcon
              footnote="Не закрывайте страницу — ждём ответ сервера"
              className="text-left"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
