import { useState, useRef, useEffect } from "react";
import { Image as ImageIcon, Mic, MapPin, Hash, X } from "lucide-react";
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

type MediaSlot =
  | { type: "done"; url: string }
  | { type: "uploading"; preview: string; id: number };

export default function CreatePost() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaSourceRef = useRef<HTMLDivElement>(null);
  const uploadIdRef = useRef(0);
  const [text, setText] = useState("");
  const [mediaItems, setMediaItems] = useState<MediaSlot[]>([]);
  const [showMediaSource, setShowMediaSource] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState("");
  const displayName = user ? [user.displayName, user.surname].filter(Boolean).join(" ") : "";
  const MAX_MEDIA = 10;
  const mediaUrls = mediaItems
    .filter((s): s is { type: "done"; url: string } => s.type === "done")
    .map((s) => s.url);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    e.target.value = "";
    const currentLen = mediaItems.length;
    const toAdd = Math.min(files.length, MAX_MEDIA - currentLen);
    if (toAdd <= 0) {
      toast({ title: "Максимум 10 фото/видео", variant: "destructive" });
      return;
    }
    setError("");
    const newSlots: MediaSlot[] = [];
    for (let i = 0; i < toAdd; i++) {
      const id = ++uploadIdRef.current;
      const preview = URL.createObjectURL(files[i]);
      newSlots.push({ type: "uploading", preview, id });
    }
    setMediaItems((prev) => [...prev, ...newSlots].slice(0, MAX_MEDIA));

    const start = currentLen;
    (async () => {
      for (let i = 0; i < toAdd; i++) {
        const slot = newSlots[i];
        if (slot.type !== "uploading") continue;
        const file = files[i];
        try {
          const toUpload = file.type.startsWith("image/") ? await compressImage(file) : file;
          const url = await uploadPostMedia(toUpload);
          setMediaItems((prev) =>
            prev.map((item) =>
              item.type === "uploading" && item.id === slot.id ? { type: "done" as const, url } : item
            )
          );
        } catch (err) {
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

  useEffect(() => {
    if (!showMediaSource) return;
    const onPointerDown = (e: PointerEvent) => {
      if (mediaSourceRef.current?.contains(e.target as Node)) return;
      setShowMediaSource(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showMediaSource]);

  const handleAddFromNative = async (source: "camera" | "gallery") => {
    setShowMediaSource(false);
    if (mediaItems.length >= MAX_MEDIA) return;
    let dataUrl: string | null = null;
    try {
      if (source === "camera") dataUrl = await takePhotoFromCamera();
      else dataUrl = await pickPhotoFromGallery();
    } catch {
      toast({ title: "Не удалось открыть камеру или галерею", variant: "destructive" });
      return;
    }
    if (!dataUrl) return;
    const id = ++uploadIdRef.current;
    setMediaItems((prev) => [...prev, { type: "uploading" as const, preview: dataUrl, id }].slice(0, MAX_MEDIA));
    try {
      const file = await dataUrlToFile(dataUrl);
      const toUpload = await compressImage(file);
      const url = await uploadPostMedia(toUpload);
      setMediaItems((prev) =>
        prev.map((item) =>
          item.type === "uploading" && item.id === id ? { type: "done" as const, url } : item
        )
      );
    } catch (err) {
      setMediaItems((prev) => prev.filter((item) => item.type !== "uploading" || item.id !== id));
      toast({ title: err instanceof Error ? err.message : "Ошибка загрузки", variant: "destructive" });
    }
  };

  const handlePublish = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError("");
    setIsPublishing(true);
    try {
      const created = await createPost({
        text: trimmed,
        mediaUrls: mediaUrls.length ? mediaUrls : undefined,
      });
      if (user?.id) {
        const channelName = [user.displayName, user.surname].filter(Boolean).join(" ") || "Профиль";
        const newPost: FeedPost = {
          id: created.id,
          authorId: user.id,
          text: trimmed,
          imageUrl: mediaUrls[0] ?? null,
          mediaUrls: mediaUrls.length ? mediaUrls : null,
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
      toast({ title: "Пост опубликован" });
      setLocation("/profile/me");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка публикации");
      toast({ title: "Не удалось опубликовать", variant: "destructive" });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background absolute inset-0 z-[100] animate-in slide-in-from-bottom-full duration-300 w-full max-w-full min-w-0 overflow-x-hidden uix-screen">
      
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
          disabled={!text.trim() || isPublishing || mediaItems.some((s) => s.type === "uploading")}
          haptic
          className={cn(
            "px-4 py-1.5 rounded-full font-semibold text-[14px] transition-all",
            text.trim() && !isPublishing && !mediaItems.some((s) => s.type === "uploading")
              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20" 
              : "bg-secondary text-muted-foreground cursor-not-allowed"
          )}
        >
          {isPublishing ? "Публикуем…" : "Опубликовать"}
        </TapScaleButton>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 p-4 flex flex-col gap-4">
        <div className="flex gap-3">
          <UserAvatar
            avatarUrl={user?.avatarUrl}
            displayName={displayName || undefined}
            seed={user?.id}
            size={40}
            className="border border-border/50"
          />
          <div className="flex-1 pt-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Что у вас нового?"
              className="w-full bg-transparent border-none focus:ring-0 resize-none min-h-[150px] text-[16px] outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {mediaItems.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-border/50 bg-secondary/30">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 p-1">
              {mediaItems.map((slot, i) => {
                const src = slot.type === "done" ? resolveUrl(slot.url) : slot.preview;
                const isVideo = slot.type === "done" ? /\.(mp4|webm|mov)(\?|$)/i.test(slot.url) : false;
                const uploading = slot.type === "uploading";
                return (
                  <div key={slot.type === "uploading" ? `u-${slot.id}` : `d-${i}-${slot.url}`} className="relative aspect-square rounded-lg overflow-hidden bg-black/10">
                    {isVideo ? (
                      <video src={src} className="w-full h-full object-cover" />
                    ) : (
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    )}
                    {uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="w-10 h-10 border-2 border-white/90 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(i)}
                      disabled={uploading}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-50"
                      aria-label="Удалить"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground px-2 pb-1">{mediaItems.filter((s) => s.type === "done").length} / {MAX_MEDIA}</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Addons Grid */}
        <div className="mt-auto pt-6 border-t border-border/50 grid grid-cols-2 gap-3 pb-safe-offset-4 relative">
          {showMediaSource && isNative() && (
            <div ref={mediaSourceRef} className="absolute bottom-full left-0 mb-2 flex flex-col rounded-xl border border-border bg-background shadow-lg py-2 z-10 min-w-[180px]">
              <button
                type="button"
                className="flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-secondary w-full"
                onClick={() => handleAddFromNative("camera")}
              >
                <span className="text-lg">📷</span>
                Камера
              </button>
              <button
                type="button"
                className="flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-secondary w-full"
                onClick={() => handleAddFromNative("gallery")}
              >
                <span className="text-lg">🖼</span>
                Галерея
              </button>
              <button
                type="button"
                className="flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-secondary w-full border-t border-border"
                onClick={() => { setShowMediaSource(false); fileInputRef.current?.click(); }}
              >
                <ImageIcon className="w-4 h-4" />
                Файлы (фото/видео)
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => (isNative() ? setShowMediaSource((v) => !v) : fileInputRef.current?.click())}
            disabled={mediaItems.length >= MAX_MEDIA}
            className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/50 hover:bg-secondary transition-colors border border-border/30 disabled:opacity-60"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
              <ImageIcon className="w-5 h-5" />
            </div>
            <span className="font-medium text-[14px]">Фото/Видео</span>
          </button>
          
          <button className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/50 hover:bg-secondary transition-colors border border-border/30">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
              <Mic className="w-5 h-5" />
            </div>
            <span className="font-medium text-[14px]">Аудио</span>
          </button>
          
          <button className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/50 hover:bg-secondary transition-colors border border-border/30">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="font-medium text-[14px]">Локация</span>
          </button>
          
          <button className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/50 hover:bg-secondary transition-colors border border-border/30">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
              <Hash className="w-5 h-5" />
            </div>
            <span className="font-medium text-[14px]">Теги</span>
          </button>
        </div>
      </div>
    </div>
  );
}
