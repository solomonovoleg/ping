import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Image as ImageIcon, Mic, Video, X, Heading1, Heading2, Heading3, Sparkles, Eye, Plus, Files } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import {
  createPost,
  uploadPostMedia,
  fetchPostsByAuthor,
  type FeedPost,
  type PostVideoTrimUpload,
} from "@/lib/posts";
import { PostVideoTrimmerModal } from "@/features/posts/video-trim";
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
import { POST_VIDEO_MAX_SECONDS } from "@shared/post-video";
import { extractMentions, MAX_POST_MENTIONS } from "@shared/schema/posts";
import { CreatePostPulseMobile } from "@/pages/CreatePostPulseMobile";
import { MentionPicker } from "@/features/chat/components/MentionPicker";
import { buildMentionList } from "@/features/chat/components/mention-list";
import type { ApiChatMember } from "@/features/chat/types";
import { listContactsWithProfiles } from "@/lib/users";

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
  if (/\.(mp4|mov|webm|m4v|3gp|3gpp)$/.test(ext)) return "video";
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

function parseEdgeIdFromSearch(search: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  try {
    return new URLSearchParams(raw).get("edgeId")?.trim() ?? "";
  } catch {
    return "";
  }
}

export default function CreatePost() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const presetEdgeId = useMemo(() => parseEdgeIdFromSearch(search), [search]);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const uploadIdRef = useRef(0);
  const mediaCountRef = useRef(0);
  const videoTrimResolverRef = useRef<((t: PostVideoTrimUpload | null) => void) | null>(null);
  const [videoTrimFile, setVideoTrimFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [mediaItems, setMediaItems] = useState<MediaSlot[]>([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isProofreading, setIsProofreading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectionToast, setSelectionToast] = useState<{ start: number; end: number; x?: number; y?: number } | null>(null);
  const [error, setError] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
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
  const pulseMobile = isMobile;

  const pulseHandleLine =
    user?.nickname?.trim() != null && user.nickname.trim() !== ""
      ? user.nickname.trim().startsWith("@")
        ? user.nickname.trim()
        : `@${user.nickname.trim()}`
      : user?.profileLink?.trim() || (user?.publicId != null ? `id${user.publicId}` : "");

  const { data: mentionContacts = [] } = useQuery({
    queryKey: ["contacts", "profiles", "mention-picker"],
    queryFn: listContactsWithProfiles,
    staleTime: 60_000,
    enabled: !!user,
  });
  const mentionMembers: ApiChatMember[] = mentionContacts.map((c) => ({
    id: c.id,
    publicId: c.publicId,
    displayName: c.displayName,
    surname: c.surname,
    avatarUrl: c.avatarUrl,
  }));

  const insertPostMention = useCallback(
    (member: ApiChatMember) => {
      const pid = member.publicId;
      if (pid == null || !Number.isFinite(Number(pid))) {
        toast({ title: "Нет публичного id у контакта", variant: "destructive" });
        return;
      }
      const token = String(pid);
      const tokens = extractMentions(text);
      if (tokens.length >= MAX_POST_MENTIONS && !tokens.includes(token)) {
        toast({ title: `Не больше ${MAX_POST_MENTIONS} упоминаний (@) в посте`, variant: "destructive" });
        return;
      }
      if (tokens.includes(token)) {
        toast({ title: "Этот контакт уже отмечен в тексте" });
        return;
      }
      const insert = `@${token} `;
      const end = textAreaRef.current?.selectionStart ?? text.length;
      const start = mentionStartPos;
      const next = `${text.slice(0, start)}${insert}${text.slice(end)}`.slice(0, MAX_CHARS);
      setText(next);
      setMentionOpen(false);
      requestAnimationFrame(() => {
        const ta = textAreaRef.current;
        if (!ta) return;
        ta.focus();
        const p = Math.min(start + insert.length, next.length);
        ta.setSelectionRange(p, p);
      });
    },
    [text, toast, mentionStartPos],
  );

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    // Сразу снимок FileList: после setState модалка размонтирует input — в части браузеров живой FileList
    // становится пустым до завершения await в цикле ниже (симптом «файл как будто не выбран»).
    const picked = Array.from(input.files ?? []);
    input.value = "";
    setShowMediaPicker(false);
    if (!picked.length) {
      console.warn("[create-post] handleFileChange: no files selected");
      return;
    }
    const currentLen = mediaCountRef.current;
    const toAdd = Math.min(picked.length, MAX_MEDIA - currentLen);
    if (toAdd <= 0) {
      toast({ title: `Достигнут лимит: ${MAX_MEDIA} медиа`, variant: "destructive" });
      return;
    }
    if (picked.length > toAdd) {
      toast({ title: `Можно добавить ещё только ${toAdd} медиа` });
    }
    setError("");
    const acceptedFiles: Array<{ file: File; kind: MediaKind; aspectRatio: number | null }> = [];
    for (let i = 0; i < toAdd; i++) {
      const f = picked[i];
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

    (async () => {
      for (const payload of acceptedFiles) {
        if (payload.kind === "video") {
          const trim = await requestVideoTrim(payload.file);
          if (!trim) {
            toast({ title: "Видео не добавлено — нажмите «Готово» в окне выбора фрагмента или закройте его, чтобы отменить" });
            continue;
          }
          const id = ++uploadIdRef.current;
          const preview = URL.createObjectURL(payload.file);
          setMediaItems((prev) =>
            [...prev, { type: "uploading" as const, preview, id, kind: "video" as const, aspectRatio: null }].slice(
              0,
              MAX_MEDIA,
            ),
          );
          setShowPreview(true);
          try {
            console.debug("[create-post] uploading video…", payload.file.name, payload.file.size);
            const url = await uploadPostMedia(payload.file, trim);
            console.debug("[create-post] uploaded:", url);
            setMediaItems((prev) =>
              prev.map((item) =>
                item.type === "uploading" && item.id === id
                  ? { type: "done" as const, url, kind: "video" as const, aspectRatio: null }
                  : item,
              ),
            );
          } catch (err) {
            console.error("[create-post] upload failed:", err);
            setMediaItems((prev) => prev.filter((item) => item.type !== "uploading" || item.id !== id));
            toast({ title: err instanceof Error ? err.message : "Ошибка загрузки", variant: "destructive" });
          } finally {
            URL.revokeObjectURL(preview);
          }
          continue;
        }

        const id = ++uploadIdRef.current;
        const preview = URL.createObjectURL(payload.file);
        setMediaItems((prev) =>
          [
            ...prev,
            {
              type: "uploading" as const,
              preview,
              id,
              kind: payload.kind,
              aspectRatio: payload.aspectRatio,
            },
          ].slice(0, MAX_MEDIA),
        );
        setShowPreview(true);
        const file = payload.file;
        try {
          console.debug("[create-post] compressing…", file.name, file.type, file.size);
          const toUpload = file.type.startsWith("image/") ? await compressImage(file) : file;
          console.debug("[create-post] uploading…", toUpload.name, toUpload.size);
          const url = await uploadPostMedia(toUpload);
          console.debug("[create-post] uploaded:", url);
          setMediaItems((prev) =>
            prev.map((item) =>
              item.type === "uploading" && item.id === id
                ? { type: "done" as const, url, kind: payload.kind, aspectRatio: payload.aspectRatio }
                : item,
            ),
          );
        } catch (err) {
          console.error("[create-post] upload failed:", err);
          setMediaItems((prev) => prev.filter((item) => item.type !== "uploading" || item.id !== id));
          toast({ title: err instanceof Error ? err.message : "Ошибка загрузки", variant: "destructive" });
        } finally {
          URL.revokeObjectURL(preview);
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
        ...(presetEdgeId ? { edgeId: presetEdgeId } : {}),
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
          edgeId: presetEdgeId || null,
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
      {!pulseMobile ? (
        <div className="glass uix-content-x pt-safe-offset-2 pb-[var(--uix-space-3)] border-b border-border/50 z-10 sticky top-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[var(--uix-space-2)]">
            <div className="flex justify-start min-w-0">
              <TapScaleButton
                type="button"
                onClick={() => setLocation("/posts")}
                haptic
                subtle
                className="text-foreground hover:bg-secondary px-2 py-2 -ml-2 rounded-full transition-colors font-medium text-[15px] leading-none min-h-[var(--uix-touch-min)] flex items-center shrink-0"
                aria-label="Отмена"
              >
                Отмена
              </TapScaleButton>
            </div>
            <h1 className="text-center text-[17px] font-semibold leading-tight tracking-tight text-foreground truncate max-w-[min(200px,46vw)]">
              Новая запись
            </h1>
            <div className="flex justify-end min-w-0">
              <TapScaleButton
                type="button"
                onClick={handlePublish}
                disabled={!canPublish}
                haptic
                className={cn(
                  "shrink-0 px-[var(--uix-space-4)] py-2 rounded-full font-semibold text-[13px] leading-none min-h-[40px] flex items-center justify-center transition-all",
                  canPublish
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/15"
                    : "bg-secondary text-muted-foreground cursor-not-allowed"
                )}
              >
                {isPublishing ? "Публикуем…" : "Опубликовать"}
              </TapScaleButton>
            </div>
          </div>
        </div>
      ) : null}

      {presetEdgeId ? (
        <div
          className="border-b border-primary/25 bg-primary/10 uix-content-x py-2.5"
          role="status"
        >
          <p className="text-[12px] leading-snug text-foreground/90">
            К посту будет привязана кампания EDGE:{" "}
            <span className="font-mono text-[11px] break-all opacity-90">{presetEdgeId}</span>
          </p>
        </div>
      ) : null}

      {pulseMobile ? (
        <CreatePostPulseMobile
          onBack={() => setLocation("/posts")}
          displayName={displayName || "Профиль"}
          handleLine={pulseHandleLine}
          avatarUrl={user?.avatarUrl}
          showVerified={Boolean(user)}
          text={text}
          setText={setText}
          textAreaRef={textAreaRef}
          maxChars={MAX_CHARS}
          mediaItems={mediaItems}
          mediaUrls={mediaUrls}
          previewLayout={previewLayout}
          hasUploading={hasUploading}
          onRemoveMedia={removeMedia}
          canPublish={canPublish}
          isPublishing={isPublishing}
          onPublish={handlePublish}
          isProofreading={isProofreading}
          onProofread={handleProofread}
          error={error}
          availableSlots={availableMediaSlots}
          isNativePlatform={isNativePlatform}
          onNativePickPhoto={() => void handleAddFromNative("gallery")}
          onOpenMediaPicker={() => setShowMediaPicker(true)}
          imageInputRef={imageInputRef}
          videoInputRef={videoInputRef}
          onFileChange={(e) => void handleFileChange(e)}
        />
      ) : null}

      {/* Editor Area */}
      {!pulseMobile ? (
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 uix-content-x flex flex-col gap-[var(--uix-space-4)] pt-[var(--uix-space-4)] pb-[calc(var(--uix-nav-bottom)+var(--uix-space-6))]"
        onScroll={() => {
          if (selectionToast && !useBottomSelectionBar) setSelectionToast(null);
        }}
      >
        <div className="flex flex-wrap items-center gap-[var(--uix-space-2)] gap-y-[var(--uix-space-2)]">
          <TapScaleButton
            type="button"
            haptic
            onClick={handleProofread}
            disabled={isProofreading || !text.trim()}
            className="rounded-full bg-primary/10 px-[var(--uix-space-3)] py-2 text-[12px] font-semibold text-primary disabled:opacity-60 min-h-[40px] inline-flex items-center"
            aria-label="Проверить орфографию ИИ"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            {isProofreading ? "Проверяем..." : "Проверить ИИ"}
          </TapScaleButton>
          <TapScaleButton
            type="button"
            haptic
            subtle
            onClick={() => setShowPreview((v) => !v)}
            className="rounded-full border border-border/70 bg-secondary/60 px-[var(--uix-space-3)] py-2 text-[12px] font-semibold min-h-[40px] inline-flex items-center"
            aria-label="Переключить предпросмотр поста"
          >
            <Eye className="mr-1.5 h-3.5 w-3.5 shrink-0" /> {showPreview ? "Редактор" : "Предпросмотр"}
          </TapScaleButton>
          <span
            className={cn(
              "ml-auto tabular-nums text-[12px] leading-none shrink-0",
              textLeft < 120 ? "text-amber-600" : "text-muted-foreground"
            )}
            title="Cmd+Enter — опубликовать"
          >
            {text.length}/{MAX_CHARS}
          </span>
        </div>
        <div className="rounded-2xl border border-border/60 bg-secondary/20 px-[var(--uix-space-4)] py-[var(--uix-space-3)] space-y-[var(--uix-space-2)]">
          <p className="text-[13px] leading-snug text-foreground/90">
            Текст, заголовки (выделите строки — H1/H2/H3) и медиа. На телефоне — галерея и камера; на ПК — выбор файлов.
          </p>
          <p className="uix-text-caption text-muted-foreground leading-relaxed">
            Видео на сервере сжимается и обрезается до {POST_VIDEO_MAX_SECONDS} с. Слотов: {mediaCount}/{MAX_MEDIA} • Осталось: {availableMediaSlots}
            {mediaUrls.length > MAX_MEDIA_PUBLISHED && (
              <span className="ml-1 text-amber-600">• В пост попадёт {MAX_MEDIA_PUBLISHED}</span>
            )}
          </p>
        </div>

        {selectionToast && !showPreview && !pulseMobile && (
          <motion.div
            className={cn(
              "fixed z-[160] rounded-2xl border border-border/70 bg-background/95 px-[var(--uix-space-4)] py-[var(--uix-space-3)] shadow-lg backdrop-blur",
              useBottomSelectionBar
                ? "left-[max(var(--uix-space-2),env(safe-area-inset-left))] right-[max(var(--uix-space-2),env(safe-area-inset-right))] bottom-[calc(var(--uix-nav-bottom)+var(--uix-space-2)+env(safe-area-inset-bottom,0px))]"
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
            <p className="mb-[var(--uix-space-3)] text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Сделать выделенное заголовком?
            </p>
            <div className="flex flex-wrap gap-[var(--uix-space-2)]">
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

        <div className="flex gap-[var(--uix-space-3)] items-start">
          <UserAvatar
            avatarUrl={user?.avatarUrl}
            displayName={displayName || undefined}
            seed={user?.id}
            size={40}
            className="border border-border/50 shrink-0 mt-0.5"
          />
          <div className="flex-1 min-w-0">
            {!showPreview ? (
              <div className="relative overflow-visible rounded-2xl border border-border/60 bg-background px-[var(--uix-space-3)] py-[var(--uix-space-3)]">
                {mentionOpen && (
                  <div className="absolute bottom-full left-0 right-0 z-30 mb-1 px-0">
                    <MentionPicker
                      members={mentionMembers}
                      query={mentionQuery}
                      selectedIndex={mentionSelectedIndex}
                      onSelectedIndexChange={setMentionSelectedIndex}
                      onSelect={(m) => insertPostMention(m)}
                    />
                  </div>
                )}
                <textarea
                  ref={textAreaRef}
                  value={text}
                  onChange={(e) => {
                    const value = e.target.value.slice(0, MAX_CHARS);
                    const pos = e.target.selectionStart ?? value.length;
                    setText(value);
                    setSelectionToast(null);
                    const beforeCursor = value.slice(0, pos);
                    const lastAt = beforeCursor.lastIndexOf("@");
                    if (lastAt >= 0) {
                      const afterAt = beforeCursor.slice(lastAt + 1);
                      if (!/[\s\n]/.test(afterAt)) {
                        setMentionOpen(true);
                        setMentionQuery(afterAt);
                        setMentionStartPos(lastAt);
                        setMentionSelectedIndex(0);
                      } else {
                        setMentionOpen(false);
                      }
                    } else {
                      setMentionOpen(false);
                    }
                  }}
                  onSelect={handleTextSelection}
                  onKeyUp={handleTextSelection}
                  onPointerUp={handleTextSelection}
                  onKeyDown={(e) => {
                    if (!mentionOpen) return;
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setMentionOpen(false);
                      return;
                    }
                    const rows = buildMentionList(mentionMembers, mentionQuery, { includeEveryone: false });
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      const maxIdx = Math.max(0, rows.length - 1);
                      setMentionSelectedIndex((i) => Math.min(i + 1, maxIdx));
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setMentionSelectedIndex((i) => Math.max(0, i - 1));
                      return;
                    }
                    if (e.key === "Enter" && !e.shiftKey) {
                      const selected = rows[Math.max(0, Math.min(mentionSelectedIndex, rows.length - 1))];
                      if (selected?.kind === "member") {
                        e.preventDefault();
                        insertPostMention(selected.member);
                      }
                    }
                  }}
                  placeholder="Что у вас нового?"
                  aria-label="Текст поста"
                  className="w-full bg-transparent border-none focus:ring-0 resize-none min-h-[min(200px,42vh)] text-[17px] leading-relaxed outline-none placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>
            ) : (
              <div className="w-full min-h-[min(160px,36vh)] rounded-2xl border border-border/60 bg-secondary/20 px-[var(--uix-space-3)] py-[var(--uix-space-3)] text-[15px] leading-relaxed">
                {text.trim().length === 0 ? (
                  <p className="text-muted-foreground text-[15px]">Предпросмотр текста появится здесь</p>
                ) : (
                  text.split("\n").map((line, i) => {
                    if (/^###\s+/.test(line))
                      return (
                        <h3 key={i} className="mb-[var(--uix-space-2)] text-[17px] font-semibold">
                          {line.replace(/^###\s+/, "")}
                        </h3>
                      );
                    if (/^##\s+/.test(line))
                      return (
                        <h2 key={i} className="mb-[var(--uix-space-2)] text-[19px] font-bold">
                          {line.replace(/^##\s+/, "")}
                        </h2>
                      );
                    if (/^#\s+/.test(line))
                      return (
                        <h1 key={i} className="mb-[var(--uix-space-3)] text-[22px] font-bold leading-tight">
                          {line.replace(/^#\s+/, "")}
                        </h1>
                      );
                    return (
                      <p key={i} className="whitespace-pre-wrap mb-[var(--uix-space-1)] last:mb-0">
                        {line || "\u00A0"}
                      </p>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="text-[13px] leading-snug text-destructive px-[var(--uix-space-1)]">{error}</p>
        )}

        {mediaItems.length > 0 && (
          <div className="rounded-2xl overflow-hidden border border-border/50 bg-secondary/25">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-[var(--uix-space-2)] p-[var(--uix-space-2)]">
              {mediaItems.map((slot, i) => {
                const src = slot.type === "done" ? resolveUrl(slot.url) : slot.preview;
                const kind = slot.type === "done" ? slot.kind : slot.kind;
                const isVideo = kind === "video";
                const isAudio = kind === "audio";
                const uploading = slot.type === "uploading";
                return (
                  <div
                    key={slot.type === "uploading" ? `u-${slot.id}` : `d-${i}-${slot.url}`}
                    className="relative aspect-square rounded-xl overflow-hidden bg-black/10 ring-1 ring-black/5"
                  >
                    {isAudio ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2">
                        <Mic className="h-5 w-5 text-primary" />
                        <audio src={src} controls preload="metadata" className="w-full" />
                      </div>
                    ) : isVideo ? (
                      <video
                        src={src}
                        className="w-full h-full object-cover"
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
                      className="absolute top-[var(--uix-space-2)] right-[var(--uix-space-2)] flex items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75 min-h-[36px] min-w-[36px] backdrop-blur-[2px]"
                      aria-label={uploading ? "Удалить (загрузка отменится)" : "Удалить"}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-border/40 bg-background/40 px-[var(--uix-space-3)] py-[var(--uix-space-2)]">
              <p className="uix-text-caption text-muted-foreground">
                {hasUploading
                  ? `Загружено ${mediaItems.filter((s) => s.type === "done").length} из ${mediaCount}…`
                  : `Готово: ${mediaItems.filter((s) => s.type === "done").length} из ${MAX_MEDIA}`}
              </p>
            </div>
          </div>
        )}

        {showPreview && mediaUrls.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-background px-[var(--uix-space-3)] py-[var(--uix-space-3)] space-y-[var(--uix-space-3)]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Предпросмотр медиа</p>
            <PostMedia mediaUrls={mediaUrls} layout={previewLayout} className="!mt-0" />
          </div>
        )}

        {/* Media Picker — прижат к низу области прокрутки, отступ снизу под таб-бар */}
        <div className="sticky bottom-0 z-[5] mt-auto pt-[var(--uix-space-4)] pb-[var(--uix-space-3)] border-t border-border/50 bg-background/92 backdrop-blur-md supports-[backdrop-filter]:bg-background/78 shadow-[0_-10px_28px_-12px_rgba(0,0,0,0.08)]">
          <div className="flex gap-[var(--uix-space-2)] items-stretch">
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
                className="flex-1 flex items-center justify-center gap-[var(--uix-space-2)] rounded-2xl border border-border/45 bg-secondary/50 px-[var(--uix-space-4)] min-h-[48px] text-[14px] font-semibold transition-colors hover:bg-secondary/80 disabled:opacity-60"
              >
                <Plus className="h-[18px] w-[18px] shrink-0 opacity-90" />
                Добавить медиа
              </TapScaleButton>
            ) : availableMediaSlots <= 0 ? (
              <TapScaleButton
                type="button"
                haptic
                onClick={() => toast({ title: `Достигнут лимит: ${MAX_MEDIA} медиа`, variant: "destructive" })}
                disabled
                className="flex-1 flex items-center justify-center gap-[var(--uix-space-2)] rounded-2xl border border-border/45 bg-secondary/50 px-[var(--uix-space-4)] min-h-[48px] text-[14px] font-semibold transition-colors hover:bg-secondary/80 disabled:opacity-60"
              >
                <Plus className="h-[18px] w-[18px] shrink-0 opacity-90" />
                Добавить медиа
              </TapScaleButton>
            ) : (
              <label className="relative flex flex-1 min-h-[48px] cursor-pointer items-center justify-center rounded-2xl border border-border/45 bg-secondary/50 px-[var(--uix-space-4)] text-[14px] font-semibold transition-colors hover:bg-secondary/80">
                <span className="pointer-events-none flex items-center justify-center gap-[var(--uix-space-2)]">
                  <Plus className="h-[18px] w-[18px] shrink-0 opacity-90" aria-hidden />
                  Добавить медиа
                </span>
                <input
                  type="file"
                  accept="image/*,video/*,audio/*,.heic,.heif"
                  multiple
                  className="absolute inset-0 z-[2] h-full w-full cursor-pointer opacity-0"
                  onChange={(e) => void handleFileChange(e)}
                  aria-label="Выбрать фото или видео"
                />
              </label>
            )}
            <TapScaleButton
              type="button"
              haptic
              subtle
              onClick={() => setShowMediaPicker(true)}
              disabled={availableMediaSlots <= 0}
              className="shrink-0 aspect-square min-h-[48px] min-w-[48px] rounded-2xl border border-border/45 bg-secondary/50 flex items-center justify-center disabled:opacity-60"
              aria-label="Выбрать тип медиа"
            >
              <Files className="h-[18px] w-[18px]" />
            </TapScaleButton>
          </div>
          <p className="mt-[var(--uix-space-2)] text-center uix-text-caption text-muted-foreground">
            Свободных слотов: {availableMediaSlots}
          </p>
        </div>
      </div>
      ) : null}

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
              className="absolute inset-0 z-0 bg-black/45"
              onClick={() => setShowMediaPicker(false)}
              aria-label="Закрыть выбор медиа"
            />
            <motion.div
              className="absolute inset-x-0 bottom-0 z-10 rounded-t-[1.25rem] border-t border-border/80 bg-background px-[var(--uix-space-3)] pt-[var(--uix-space-2)] pb-[calc(var(--uix-space-4)+env(safe-area-inset-bottom,0px))] shadow-2xl"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: prefersReducedMotion ? 0.05 : DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
            >
            <div className="mx-auto mb-[var(--uix-space-3)] h-1 w-10 rounded-full bg-muted-foreground/20" aria-hidden />
            <p className="px-[var(--uix-space-2)] pb-[var(--uix-space-3)] text-[13px] font-semibold text-foreground">
              Источник медиа
            </p>
            <div className="flex flex-col gap-[var(--uix-space-1)]">
            {isNativePlatform && (
              <TapScaleButton
                type="button"
                haptic
                subtle
                className="flex w-full items-center gap-[var(--uix-space-3)] rounded-xl px-[var(--uix-space-3)] py-[var(--uix-space-3)] text-left text-[15px] min-h-[52px]"
                onClick={() => handleAddFromNative("camera")}
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-lg" aria-hidden>
                  📷
                </span>
                Камера
              </TapScaleButton>
            )}

            {isNativePlatform ? (
              <TapScaleButton
                type="button"
                haptic
                subtle
                className="flex w-full items-center gap-[var(--uix-space-3)] rounded-xl px-[var(--uix-space-3)] py-[var(--uix-space-3)] text-left text-[15px] min-h-[52px]"
                onClick={() => handleAddFromNative("gallery")}
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-600">
                  <ImageIcon className="h-[18px] w-[18px]" />
                </span>
                Фото из галереи
              </TapScaleButton>
            ) : (
              <label className="relative flex w-full min-h-[52px] cursor-pointer items-stretch rounded-xl text-left text-[15px] hover:bg-secondary/60 active:bg-secondary/80">
                <span className="pointer-events-none flex w-full items-center gap-[var(--uix-space-3)] px-[var(--uix-space-3)] py-[var(--uix-space-3)]">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-600">
                    <ImageIcon className="h-[18px] w-[18px]" />
                  </span>
                  Фото
                </span>
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  className="absolute inset-0 z-[2] h-full w-full cursor-pointer opacity-0"
                  onChange={(e) => void handleFileChange(e)}
                  aria-label="Выбрать фото"
                />
              </label>
            )}

            <label className="relative flex w-full min-h-[52px] cursor-pointer items-stretch rounded-xl text-left text-[15px] hover:bg-secondary/60 active:bg-secondary/80">
              <span className="pointer-events-none flex w-full items-center gap-[var(--uix-space-3)] px-[var(--uix-space-3)] py-[var(--uix-space-3)]">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-600">
                  <Video className="h-[18px] w-[18px]" />
                </span>
                Видео
              </span>
              <input
                type="file"
                accept="video/*,.mp4,.mov,.webm,.m4v"
                multiple
                className="absolute inset-0 z-[2] h-full w-full cursor-pointer opacity-0"
                onChange={(e) => void handleFileChange(e)}
                aria-label="Выбрать видео"
              />
            </label>

            <label className="relative flex w-full min-h-[52px] cursor-pointer items-stretch rounded-xl text-left text-[15px] hover:bg-secondary/60 active:bg-secondary/80">
              <span className="pointer-events-none flex w-full items-center gap-[var(--uix-space-3)] px-[var(--uix-space-3)] py-[var(--uix-space-3)]">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600">
                  <Mic className="h-[18px] w-[18px]" />
                </span>
                Аудио
              </span>
              <input
                type="file"
                accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg"
                multiple
                className="absolute inset-0 z-[2] h-full w-full cursor-pointer opacity-0"
                onChange={(e) => void handleFileChange(e)}
                aria-label="Выбрать аудио"
              />
            </label>

            <label className="relative flex w-full min-h-[52px] cursor-pointer items-stretch rounded-xl text-left text-[15px] hover:bg-secondary/60 active:bg-secondary/80">
              <span className="pointer-events-none flex w-full items-center gap-[var(--uix-space-3)] px-[var(--uix-space-3)] py-[var(--uix-space-3)]">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Files className="h-[18px] w-[18px]" />
                </span>
                Все файлы
              </span>
              <input
                type="file"
                accept="image/*,video/*,audio/*,.heic,.heif,.mov,.m4v"
                multiple
                className="absolute inset-0 z-[2] h-full w-full cursor-pointer opacity-0"
                onChange={(e) => void handleFileChange(e)}
                aria-label="Выбрать файлы медиа"
              />
            </label>
            </div>

            <TapScaleButton
              type="button"
              haptic
              subtle
              className="mt-[var(--uix-space-3)] w-full rounded-xl border border-border/60 bg-secondary/45 px-[var(--uix-space-4)] py-[var(--uix-space-3)] text-[15px] font-medium min-h-[48px]"
              onClick={() => setShowMediaPicker(false)}
            >
              Отмена
            </TapScaleButton>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PostVideoTrimmerModal
        open={!!videoTrimFile}
        file={videoTrimFile}
        onOpenChange={handleVideoTrimOpenChange}
        onConfirm={handleVideoTrimConfirm}
      />
    </motion.div>
  );
}
