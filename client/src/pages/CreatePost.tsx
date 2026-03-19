import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Image as ImageIcon, Mic, Video, X, Heading1, Heading2, Heading3, Sparkles, Eye, Plus, Files } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { createPost, uploadPostMedia, fetchPostsByAuthor, type FeedPost } from "@/lib/posts";
import { compressImage } from "@/lib/compress-image";
import { resolveUrl } from "@/lib/api-base";
import { isNative, takePhotoFromCamera, pickPhotoFromGallery } from "@/lib/capacitor-native";
import { useToast } from "@/hooks/use-toast";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { proofreadText } from "@/lib/ai-chat";
import { PostMedia } from "@/components/PostMedia";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DURATION_FAST_S,
  DURATION_NORMAL_S,
  DURATION_TOAST_AUTO_DISMISS_MS,
  EASING_OUT_BEZIER,
  usePrefersReducedMotion,
} from "@/lib/motion";
import { getTextareaCaretCoordinates } from "@/lib/textarea-caret";
import { useCreatePostDraft } from "@/hooks/useCreatePostDraft";
import { buildPostMediaLayout, type PostMediaLayout } from "@shared/post-media-layout";

type MediaKind = "image" | "video" | "audio";

type MediaSlot =
  | { type: "done"; url: string; kind: MediaKind; aspectRatio?: number | null }
  | { type: "uploading"; preview: string; id: number; kind: MediaKind; aspectRatio?: number | null };

const MAX_MEDIA = 10;
const MAX_MEDIA_PUBLISHED = 10; // Сервер принимает до 10 медиа в посте
const MAX_CHARS = 8000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function detectKindFromFile(file: File): MediaKind | null {
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  const ext = file.name.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|heic|heif)$/.test(ext)) return "image";
  if (/\.(mp4|mov|webm)$/.test(ext)) return "video";
  if (/\.(mp3|m4a|aac|wav|ogg)$/.test(ext)) return "audio";
  return null;
}

async function getImageAspectFromFile(file: File): Promise<number | null> {
  if (!file.type.startsWith("image/")) return null;
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = objectUrl;
    });
    if (!img.naturalWidth || !img.naturalHeight) return null;
    return img.naturalWidth / img.naturalHeight;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function getImageAspectFromDataUrl(dataUrl: string): Promise<number | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });
    if (!img.naturalWidth || !img.naturalHeight) return null;
    return img.naturalWidth / img.naturalHeight;
  } catch {
    return null;
  }
}

export default function CreatePost() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const uploadIdRef = useRef(0);
  const mediaCountRef = useRef(0);
  const [text, setText] = useState("");
  const [mediaItems, setMediaItems] = useState<MediaSlot[]>([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isProofreading, setIsProofreading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectionToast, setSelectionToast] = useState<{ start: number; end: number; x?: number; y?: number } | null>(null);
  const [error, setError] = useState("");
  const isMobile = useIsMobile();
  const isNativePlatform = isNative();
  const useBottomSelectionBar = isNativePlatform || isMobile;
  const prefersReducedMotion = usePrefersReducedMotion();
  const displayName = user ? [user.displayName, user.surname].filter(Boolean).join(" ") : "";
  const textLeft = MAX_CHARS - text.length;
  const hasUploading = mediaItems.some((s) => s.type === "uploading");
  const mediaCount = mediaItems.length;
  mediaCountRef.current = mediaCount;
  const availableMediaSlots = Math.max(0, MAX_MEDIA - mediaCount);
  const mediaUrls = mediaItems
    .filter((s): s is { type: "done"; url: string; kind: MediaKind } => s.type === "done")
    .map((s) => s.url);
  const previewLayout = (() => {
    const doneItems = mediaItems.filter((s): s is { type: "done"; url: string; kind: MediaKind; aspectRatio?: number | null } => s.type === "done");
    const imageItems = doneItems.filter((s) => s.kind === "image");
    if (!imageItems.length || imageItems.length !== doneItems.length) return null;
    const aspects = imageItems.map((s) => (typeof s.aspectRatio === "number" && Number.isFinite(s.aspectRatio) ? s.aspectRatio : 1));
    return buildPostMediaLayout(aspects);
  })();
  const canPublish = (text.trim().length > 0 || mediaUrls.length > 0) && !isPublishing && !hasUploading;

  const { clearDraft } = useCreatePostDraft(
    MAX_CHARS,
    MAX_MEDIA,
    text,
    setText,
    mediaItems,
    setMediaItems,
    toast
  );

  useEffect(() => {
    if (!selectionToast) return;
    const t = setTimeout(() => setSelectionToast(null), DURATION_TOAST_AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [selectionToast]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) {
      console.warn("[create-post] handleFileChange: no files selected");
      return;
    }
    e.target.value = "";
    const currentLen = mediaCountRef.current;
    const toAdd = Math.min(files.length, MAX_MEDIA - currentLen);
    if (toAdd <= 0) {
      toast({ title: `Достигнут лимит: ${MAX_MEDIA} медиа`, variant: "destructive" });
      return;
    }
    if (files.length > toAdd) {
      toast({ title: `Можно добавить ещё только ${toAdd} медиа` });
    }
    setError("");
    const acceptedFiles: Array<{ file: File; kind: MediaKind; aspectRatio: number | null }> = [];
    for (let i = 0; i < toAdd; i++) {
      const f = files[i];
      const kind = detectKindFromFile(f);
      if (!kind) {
        console.warn("[create-post] file rejected (unknown kind):", f.name, f.type);
        continue;
      }
      const aspectRatio = kind === "image" ? await getImageAspectFromFile(f) : null;
      acceptedFiles.push({ file: f, kind, aspectRatio });
    }
    if (acceptedFiles.length === 0) {
      toast({ title: "Поддерживаются только фото, видео и аудио", variant: "destructive" });
      return;
    }

    const newSlots: MediaSlot[] = [];
    for (let i = 0; i < toAdd; i++) {
      const item = acceptedFiles[i];
      if (!item) continue;
      const id = ++uploadIdRef.current;
      const preview = URL.createObjectURL(item.file);
      newSlots.push({ type: "uploading", preview, id, kind: item.kind, aspectRatio: item.aspectRatio });
    }
    setMediaItems((prev) => [...prev, ...newSlots].slice(0, MAX_MEDIA));
    setShowPreview(true);

    (async () => {
      for (let i = 0; i < newSlots.length; i++) {
        const slot = newSlots[i];
        if (slot.type !== "uploading") continue;
        const payload = acceptedFiles[i];
        if (!payload) continue;
        const file = payload.file;
        try {
          console.debug("[create-post] compressing…", file.name, file.type, file.size);
          const toUpload = file.type.startsWith("image/") ? await compressImage(file) : file;
          console.debug("[create-post] uploading…", toUpload.name, toUpload.size);
          const url = await uploadPostMedia(toUpload);
          console.debug("[create-post] uploaded:", url);
          setMediaItems((prev) =>
            prev.map((item) =>
              item.type === "uploading" && item.id === slot.id
                ? { type: "done" as const, url, kind: payload.kind, aspectRatio: payload.aspectRatio }
                : item
            )
          );
        } catch (err) {
          console.error("[create-post] upload failed:", err);
          setMediaItems((prev) => prev.filter((item) => item.type !== "uploading" || item.id !== slot.id));
          toast({ title: err instanceof Error ? err.message : "Ошибка загрузки", variant: "destructive" });
        } finally {
          URL.revokeObjectURL(slot.preview);
        }
      }
    })();
  };

  const removeMedia = (index: number) => {
    const item = mediaItems[index];
    if (item?.type === "uploading") URL.revokeObjectURL(item.preview);
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
  };

  const dataUrlToFile = async (dataUrl: string, name = "photo.jpg"): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || "image/jpeg" });
  };

  const handleAddFromNative = async (source: "camera" | "gallery") => {
    setShowMediaPicker(false);
    const slotsLeft = Math.max(0, MAX_MEDIA - mediaItems.length);
    if (slotsLeft <= 0) {
      toast({ title: `Достигнут лимит: ${MAX_MEDIA} медиа`, variant: "destructive" });
      return;
    }
    let dataUrl: string | null = null;
    try {
      if (source === "camera") dataUrl = await takePhotoFromCamera();
      else dataUrl = await pickPhotoFromGallery();
    } catch {
      toast({ title: "Не удалось открыть камеру или галерею. Выберите фото через Файлы.", variant: "destructive" });
      setShowMediaPicker(true);
      return;
    }
    if (!dataUrl) {
      toast({ title: "Фото не выбрано. Выберите через Файлы.", variant: "destructive" });
      setShowMediaPicker(true);
      return;
    }
    const aspectRatio = await getImageAspectFromDataUrl(dataUrl);
    const id = ++uploadIdRef.current;
    setMediaItems((prev) => [...prev, { type: "uploading" as const, preview: dataUrl, id, kind: "image" as const, aspectRatio }].slice(0, MAX_MEDIA));
    setShowPreview(true);
    try {
      const file = await dataUrlToFile(dataUrl);
      const toUpload = await compressImage(file);
      const url = await uploadPostMedia(toUpload);
      setMediaItems((prev) =>
        prev.map((item) =>
          item.type === "uploading" && item.id === id ? { type: "done" as const, url, kind: "image" as const, aspectRatio } : item
        )
      );
    } catch (err) {
      setMediaItems((prev) => prev.filter((item) => item.type !== "uploading" || item.id !== id));
      toast({ title: err instanceof Error ? err.message : "Ошибка загрузки", variant: "destructive" });
    }
  };

  const insertHeading = (level: 1 | 2 | 3) => {
    const ta = textAreaRef.current;
    if (!ta) return;
    const marker = `${"#".repeat(level)} `;
    const start = selectionToast?.start ?? ta.selectionStart;
    const end = selectionToast?.end ?? ta.selectionEnd;
    if (start === end) return;
    const selected = text.slice(start, end);
    const nextChunk = selected.length
      ? selected
          .split("\n")
          .map((line) => `${marker}${line.replace(/^#{1,3}\s+/, "")}`)
          .join("\n")
      : marker;
    const next = `${text.slice(0, start)}${nextChunk}${text.slice(end)}`.slice(0, MAX_CHARS);
    setText(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = Math.min(start + nextChunk.length, MAX_CHARS);
      ta.setSelectionRange(pos, pos);
      setSelectionToast(null);
    });
  };

  const handleTextSelection = () => {
    const ta = textAreaRef.current;
    if (!ta || showPreview) {
      setSelectionToast(null);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const hasSelection = end - start > 0;
    if (!hasSelection) {
      setSelectionToast(null);
      return;
    }
    if (useBottomSelectionBar) {
      setSelectionToast({ start, end });
      return;
    }
    const textareaRect = ta.getBoundingClientRect();
    const startPos = getTextareaCaretCoordinates(ta, start);
    const endPos = getTextareaCaretCoordinates(ta, end);
    const centerX = textareaRect.left + ((startPos.left + endPos.left) / 2) - ta.scrollLeft;
    const topY = textareaRect.top + Math.min(startPos.top, endPos.top) - ta.scrollTop;
    const x = clamp(centerX, 84, window.innerWidth - 84);
    const y = clamp(topY - 14, 76, window.innerHeight - 120);
    setSelectionToast({ start, end, x, y });
  };

  const handleProofread = async () => {
    if (!text.trim()) {
      toast({ title: "Добавьте текст для проверки", variant: "destructive" });
      return;
    }
    setIsProofreading(true);
    try {
      const fixed = await proofreadText(text);
      setText(fixed.slice(0, MAX_CHARS));
      toast({ title: "Текст проверен ИИ" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Ошибка ИИ-проверки", variant: "destructive" });
    } finally {
      setIsProofreading(false);
    }
  };

  const handlePublish = async () => {
    const trimmed = text.trim();
    if (!trimmed && mediaUrls.length === 0) return;
    const doneItems = mediaItems.filter((s): s is { type: "done"; url: string; kind: MediaKind; aspectRatio?: number | null } => s.type === "done");
    const imageItems = doneItems.filter((s) => s.kind === "image");
    let mediaLayout: PostMediaLayout | null = null;
    if (imageItems.length > 0 && imageItems.length === doneItems.length) {
      const aspects = imageItems.map((s) => (typeof s.aspectRatio === "number" && Number.isFinite(s.aspectRatio) ? s.aspectRatio : 1));
      mediaLayout = buildPostMediaLayout(aspects);
    }
    setError("");
    setIsPublishing(true);
    try {
      const created = await createPost({
        text: trimmed,
        mediaUrls: mediaUrls.length ? mediaUrls : undefined,
        mediaLayout,
      });
      if (user?.id) {
        const channelName = [user.displayName, user.surname].filter(Boolean).join(" ") || "Профиль";
        const newPost: FeedPost = {
          id: created.id,
          authorId: user.id,
          text: trimmed || "",
          imageUrl: mediaUrls[0] ?? null,
          mediaUrls: mediaUrls.length ? mediaUrls : null,
          mediaLayout,
          reactions: [],
          myReaction: null,
          viewsCount: 0,
          createdAt: created.createdAt,
          channelName,
          author: {
            id: user.id,
            publicId: user.publicId ?? 0,
            displayName: user.displayName ?? null,
            surname: user.surname ?? null,
            avatarUrl: user.avatarUrl ?? null,
          },
          commentsCount: 0,
        };
        queryClient.setQueryData<FeedPost[]>(["posts", "author", user.id], (prev = []) => [newPost, ...prev]);
        queryClient.setQueryData<FeedPost[]>(["posts", "feed"], (prev = []) => [newPost, ...prev]);
        const fromServer = await fetchPostsByAuthor(user.id, 50);
        if (fromServer.length > 0) {
          queryClient.setQueryData(["posts", "author", user.id], fromServer);
        }
        await queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
      }
      await queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
      clearDraft();
      toast({ title: "Пост опубликован" });
      setLocation("/profile/me");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ошибка публикации";
      setError(message);
      toast({ title: message, variant: "destructive" });
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublishRef = useRef(handlePublish);
  handlePublishRef.current = handlePublish;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handlePublishRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <motion.div
      className="flex flex-col h-full bg-background absolute inset-0 z-[100] w-full max-w-full min-w-0 overflow-x-hidden uix-screen"
      initial={prefersReducedMotion ? false : { y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
    >
      {/* Header */}
      <div className="glass uix-content-x py-3 flex items-center justify-between border-b border-border/50 pt-safe-offset-2 z-10 sticky top-0">
        <TapScaleButton
          type="button"
          onClick={() => setLocation("/posts")}
          haptic
          subtle
          className="text-foreground hover:bg-secondary p-2 -ml-2 rounded-full transition-colors font-medium text-[16px] min-h-[var(--uix-touch-min)] flex items-center"
          aria-label="Отмена"
        >
          Отмена
        </TapScaleButton>
        
        <span className="uix-text-title font-semibold">Новая запись</span>
        
        <TapScaleButton
          type="button"
          onClick={handlePublish}
          disabled={!canPublish}
          haptic
          className={cn(
            "px-4 py-1.5 rounded-full font-semibold text-[14px] transition-all",
            canPublish
              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20" 
              : "bg-secondary text-muted-foreground cursor-not-allowed"
          )}
        >
          {isPublishing ? "Публикуем…" : "Опубликовать"}
        </TapScaleButton>
      </div>

      {/* Editor Area */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 p-4 flex flex-col gap-4"
        onScroll={() => {
          if (selectionToast && !useBottomSelectionBar) setSelectionToast(null);
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <TapScaleButton
            type="button"
            haptic
            onClick={handleProofread}
            disabled={isProofreading || !text.trim()}
            className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-60"
            aria-label="Проверить орфографию ИИ"
          >
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            {isProofreading ? "Проверяем..." : "Проверить ИИ"}
          </TapScaleButton>
          <TapScaleButton
            type="button"
            haptic
            subtle
            onClick={() => setShowPreview((v) => !v)}
            className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold"
            aria-label="Переключить предпросмотр поста"
          >
            <Eye className="mr-1 h-3.5 w-3.5" /> {showPreview ? "Редактор" : "Предпросмотр"}
          </TapScaleButton>
          <span className={cn("ml-auto text-xs", textLeft < 120 ? "text-amber-600" : "text-muted-foreground")} title="Cmd+Enter — опубликовать">
            {text.length}/{MAX_CHARS}
          </span>
        </div>
        <div className="rounded-2xl border border-border/60 bg-secondary/25 px-3 py-2.5">
          <p className="text-[13px] text-foreground/90">
            Добавьте текст и медиа. Можно смешивать фото, видео и аудио.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Слотов: {mediaCount}/{MAX_MEDIA} • Осталось: {availableMediaSlots}
            {mediaUrls.length > MAX_MEDIA_PUBLISHED && (
              <span className="ml-1 text-amber-600">• В пост попадёт {MAX_MEDIA_PUBLISHED}</span>
            )}
          </p>
        </div>

        {selectionToast && !showPreview && (
          <motion.div
            className={cn(
              "fixed z-[160] rounded-2xl border border-border/70 bg-background/95 px-3 py-2 shadow-lg backdrop-blur",
              useBottomSelectionBar
                ? "left-2 right-2 bottom-[calc(var(--uix-nav-bottom)+env(safe-area-inset-bottom,0px)+8px)]"
                : "w-[min(320px,calc(100vw-16px))] -translate-x-1/2"
            )}
            style={
              useBottomSelectionBar
                ? undefined
                : { left: `${selectionToast.x ?? window.innerWidth / 2}px`, top: `${selectionToast.y ?? 96}px` }
            }
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: DURATION_FAST_S, ease: EASING_OUT_BEZIER }}
          >
            <p className="mb-2 text-[11px] font-medium text-muted-foreground">Сделать выделенное заголовком?</p>
            <div className="flex flex-wrap gap-2">
              <TapScaleButton
                type="button"
                haptic
                subtle
                onClick={() => insertHeading(1)}
                onMouseDown={(e) => e.preventDefault()}
                className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold"
                aria-label="Сделать выделенное заголовком H1"
              >
                <Heading1 className="mr-1 h-3.5 w-3.5" /> H1
              </TapScaleButton>
              <TapScaleButton
                type="button"
                haptic
                subtle
                onClick={() => insertHeading(2)}
                onMouseDown={(e) => e.preventDefault()}
                className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold"
                aria-label="Сделать выделенное заголовком H2"
              >
                <Heading2 className="mr-1 h-3.5 w-3.5" /> H2
              </TapScaleButton>
              <TapScaleButton
                type="button"
                haptic
                subtle
                onClick={() => insertHeading(3)}
                onMouseDown={(e) => e.preventDefault()}
                className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold"
                aria-label="Сделать выделенное заголовком H3"
              >
                <Heading3 className="mr-1 h-3.5 w-3.5" /> H3
              </TapScaleButton>
              <TapScaleButton
                type="button"
                haptic
                subtle
                onClick={() => setSelectionToast(null)}
                onMouseDown={(e) => e.preventDefault()}
                className="rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                aria-label="Скрыть панель форматирования"
              >
                Не сейчас
              </TapScaleButton>
            </div>
          </motion.div>
        )}

        <div className="flex gap-3">
          <UserAvatar
            avatarUrl={user?.avatarUrl}
            displayName={displayName || undefined}
            seed={user?.id}
            size={40}
            className="border border-border/50"
          />
          <div className="flex-1 pt-1">
            {!showPreview ? (
              <div className="rounded-2xl border border-border/60 bg-background px-3 py-2">
                <textarea
                  ref={textAreaRef}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value.slice(0, MAX_CHARS));
                    setSelectionToast(null);
                  }}
                  onSelect={handleTextSelection}
                  onKeyUp={handleTextSelection}
                  onPointerUp={handleTextSelection}
                  placeholder="Что у вас нового?"
                  aria-label="Текст поста"
                  className="w-full bg-transparent border-none focus:ring-0 resize-none min-h-[180px] text-[16px] outline-none placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>
            ) : (
              <div className="w-full min-h-[150px] rounded-xl border border-border/60 bg-secondary/20 px-3 py-2 text-[15px] leading-relaxed">
                {text.trim().length === 0 ? (
                  <p className="text-muted-foreground">Предпросмотр текста появится здесь</p>
                ) : (
                  text.split("\n").map((line, i) => {
                    if (/^###\s+/.test(line)) return <h3 key={i} className="mb-1 text-[17px] font-semibold">{line.replace(/^###\s+/, "")}</h3>;
                    if (/^##\s+/.test(line)) return <h2 key={i} className="mb-1.5 text-[20px] font-bold">{line.replace(/^##\s+/, "")}</h2>;
                    if (/^#\s+/.test(line)) return <h1 key={i} className="mb-2 text-[24px] font-bold">{line.replace(/^#\s+/, "")}</h1>;
                    return <p key={i} className="whitespace-pre-wrap">{line || "\u00A0"}</p>;
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {mediaItems.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-border/50 bg-secondary/30">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 p-1">
              {mediaItems.map((slot, i) => {
                const src = slot.type === "done" ? resolveUrl(slot.url) : slot.preview;
                const kind = slot.type === "done" ? slot.kind : slot.kind;
                const isVideo = kind === "video";
                const isAudio = kind === "audio";
                const uploading = slot.type === "uploading";
                return (
                  <div key={slot.type === "uploading" ? `u-${slot.id}` : `d-${i}-${slot.url}`} className="relative aspect-square rounded-lg overflow-hidden bg-black/10">
                    {isAudio ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2">
                        <Mic className="h-5 w-5 text-primary" />
                        <audio src={src} controls preload="metadata" className="w-full" />
                      </div>
                    ) : isVideo ? (
                      <video src={src} className="w-full h-full object-cover" playsInline muted controls preload="metadata" />
                    ) : (
                      <img src={src} alt={`Медиа ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    )}
                    {uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="w-10 h-10 border-2 border-white/90 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(i)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-50 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]"
                      aria-label={uploading ? "Удалить (загрузка отменится)" : "Удалить"}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground px-2 pb-1">
              {hasUploading
                ? `Загружено: ${mediaItems.filter((s) => s.type === "done").length} из ${mediaCount} • загрузка…`
                : `${mediaItems.filter((s) => s.type === "done").length} / ${MAX_MEDIA}`}
            </p>
          </div>
        )}

        {showPreview && mediaUrls.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-background px-3 py-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Предпросмотр медиа</p>
            <PostMedia mediaUrls={mediaUrls} layout={previewLayout} />
          </div>
        )}

        {/* Media Picker */}
        <div className="sticky bottom-[calc(var(--uix-nav-bottom)+env(safe-area-inset-bottom,0px))] mt-auto pt-3 pb-2 border-t border-border/50 bg-background/95 backdrop-blur grid grid-cols-3 gap-2 relative">
          <div className="col-span-3 flex gap-2">
            {isNativePlatform ? (
              <TapScaleButton
                type="button"
                haptic
                onClick={() => {
                  if (availableMediaSlots <= 0) {
                    toast({ title: `Достигнут лимит: ${MAX_MEDIA} медиа`, variant: "destructive" });
                    return;
                  }
                  setShowMediaPicker(true);
                }}
                disabled={availableMediaSlots <= 0}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-border/40 bg-secondary/55 px-4 py-3 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Добавить медиа
              </TapScaleButton>
            ) : availableMediaSlots <= 0 ? (
              <TapScaleButton
                type="button"
                haptic
                onClick={() => toast({ title: `Достигнут лимит: ${MAX_MEDIA} медиа`, variant: "destructive" })}
                disabled
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-border/40 bg-secondary/55 px-4 py-3 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Добавить медиа
              </TapScaleButton>
            ) : (
              <label className="relative flex-1 flex items-center justify-center gap-2 rounded-2xl border border-border/40 bg-secondary/55 px-4 py-3 text-sm font-semibold transition-colors hover:bg-secondary min-h-[var(--uix-touch-min)] cursor-pointer">
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                  onChange={(e) => void handleFileChange(e)}
                  aria-label="Выбрать фото или видео"
                />
                <Plus className="h-4 w-4" />
                Добавить медиа
              </label>
            )}
            <TapScaleButton
              type="button"
              haptic
              subtle
              onClick={() => setShowMediaPicker(true)}
              disabled={availableMediaSlots <= 0}
              className="rounded-2xl border border-border/40 bg-secondary/55 px-3 py-3 text-sm font-semibold disabled:opacity-60"
              aria-label="Выбрать тип медиа"
            >
              <Files className="h-4 w-4" />
            </TapScaleButton>
          </div>
          <div className="col-span-3 px-1 pt-0.5 text-[11px] text-muted-foreground text-center">
            Можно добавить ещё: {availableMediaSlots}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showMediaPicker && (
          <motion.div
            className="fixed inset-0 z-[180]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.05 : DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/45"
              onClick={() => setShowMediaPicker(false)}
              aria-label="Закрыть выбор медиа"
            />
            <motion.div
              className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-background p-3 pb-[calc(var(--uix-space-3)+env(safe-area-inset-bottom,0px))] shadow-2xl"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: prefersReducedMotion ? 0.05 : DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
            >
            <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">Выберите источник медиа</p>

            {isNativePlatform && (
              <TapScaleButton
                type="button"
                haptic
                subtle
                className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left"
                onClick={() => handleAddFromNative("camera")}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">📷</span>
                Камера
              </TapScaleButton>
            )}

            {isNativePlatform ? (
              <TapScaleButton
                type="button"
                haptic
                subtle
                className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left"
                onClick={() => handleAddFromNative("gallery")}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/10 text-sky-600">
                  <ImageIcon className="h-4 w-4" />
                </span>
                Фото
              </TapScaleButton>
            ) : (
              <label className="relative mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-secondary/60 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    setShowMediaPicker(false);
                    void handleFileChange(e);
                  }}
                  aria-label="Выбрать фото"
                />
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/10 text-sky-600">
                  <ImageIcon className="h-4 w-4" />
                </span>
                Фото
              </label>
            )}

            <label className="relative mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-secondary/60 cursor-pointer">
              <input
                type="file"
                accept="video/*"
                multiple
                className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  setShowMediaPicker(false);
                  void handleFileChange(e);
                }}
                aria-label="Выбрать видео"
              />
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/10 text-purple-600">
                <Video className="h-4 w-4" />
              </span>
              Видео
            </label>

            <label className="relative mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-secondary/60 cursor-pointer">
              <input
                type="file"
                accept="audio/*"
                multiple
                className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  setShowMediaPicker(false);
                  void handleFileChange(e);
                }}
                aria-label="Выбрать аудио"
              />
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 text-rose-600">
                <Mic className="h-4 w-4" />
              </span>
              Аудио
            </label>

            <label className="relative mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-secondary/60 cursor-pointer">
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  setShowMediaPicker(false);
                  void handleFileChange(e);
                }}
                aria-label="Выбрать файлы медиа"
              />
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Files className="h-4 w-4" />
              </span>
              Файлы
            </label>

            <TapScaleButton
              type="button"
              haptic
              subtle
              className="w-full rounded-xl border border-border/70 bg-secondary/40 px-3 py-2.5 text-sm font-medium"
              onClick={() => setShowMediaPicker(false)}
            >
              Отмена
            </TapScaleButton>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
