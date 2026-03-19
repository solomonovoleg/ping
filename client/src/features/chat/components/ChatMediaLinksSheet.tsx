/**
 * Утилита: просмотр медиафайлов и ссылок чата (как в Telegram).
 * Отдельный Sheet с вкладками «Медиа» и «Ссылки».
 */
import { useState, useEffect, useCallback } from "react";
import { Image, Link2, Mic, Video, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getChatMedia, getChatLinks } from "@/lib/chat";
import { resolveUrl } from "@/lib/api-base";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ListEmptyState } from "@/components/ui/empty";
import { TapScaleButton } from "@/components/ui/tap-scale";

type Tab = "media" | "links";

type MediaItem = { id: string; type: string; content: string; createdAt: string };
type LinkItem = { url: string; messageId: string; createdAt: string };

export function ChatMediaLinksSheet({
  open,
  onOpenChange,
  chatId,
  chatName,
  folderId,
  onOpenMedia,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  chatName: string;
  folderId?: string | null;
  /** Открыть медиа во встроенном просмотрщике (вместо внешнего окна) */
  onOpenMedia?: (src: string, type: "image" | "video" | "video_note") => void;
}) {
  const [tab, setTab] = useState<Tab>("media");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getChatMedia(chatId, { folderId, limit: 50 });
      setMedia(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [chatId, folderId]);

  const loadLinks = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getChatLinks(chatId, { folderId, limit: 50 });
      setLinks(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [chatId, folderId]);

  useEffect(() => {
    if (!open || !chatId) return;
    if (tab === "media") loadMedia();
    else loadLinks();
  }, [open, chatId, tab, loadMedia, loadLinks]);

  const handleOpenLink = (url: string) => {
    const href = url.startsWith("http") ? url : `https://${url}`;
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] flex flex-col rounded-t-2xl"
      >
        <SheetHeader className="shrink-0">
          <SheetTitle className="text-base font-semibold">
            {chatName || "Чат"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex shrink-0 gap-1 border-b border-border/60 pb-2">
          <TapScaleButton
            type="button"
            onClick={() => setTab("media")}
            aria-pressed={tab === "media"}
            aria-label="Медиафайлы"
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
              tab === "media"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
            )}
          >
            <Image className="inline-block w-4 h-4 mr-1.5 -mt-0.5" aria-hidden />
            Медиа
          </TapScaleButton>
          <TapScaleButton
            type="button"
            onClick={() => setTab("links")}
            aria-pressed={tab === "links"}
            aria-label="Ссылки"
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
              tab === "links"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
            )}
          >
            <Link2 className="inline-block w-4 h-4 mr-1.5 -mt-0.5" aria-hidden />
            Ссылки
          </TapScaleButton>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <ListEmptyState
              icon={Image}
              title="Ошибка загрузки"
              description={error}
              actionLabel="Повторить"
              onAction={tab === "media" ? loadMedia : loadLinks}
            />
          ) : tab === "media" ? (
            media.length === 0 ? (
              <ListEmptyState
                icon={Image}
                title="Нет медиафайлов"
                description="Фото, видео и голосовые сообщения появятся здесь"
              />
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {media.map((item) => {
                  const url = resolveUrl(item.content);
                  const mediaType = item.type === "image" ? "image" : item.type === "video" || item.type === "video_note" ? (item.type as "video" | "video_note") : null;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (!url) return;
                        if (mediaType && onOpenMedia) {
                          onOpenMedia(url, mediaType);
                          onOpenChange(false);
                        } else {
                          window.open(url, "_blank", "noopener,noreferrer");
                        }
                      }}
                      className="aspect-square rounded-lg overflow-hidden bg-muted/50 block focus:outline-none focus:ring-2 focus:ring-primary/50 w-full text-left"
                    >
                      {item.type === "image" ? (
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : item.type === "video" || item.type === "video_note" ? (
                        <div className="relative w-full h-full bg-black/20">
                          <video
                            src={url}
                            className="w-full h-full object-cover"
                            preload="metadata"
                          />
                          <Video className="absolute right-1 bottom-1 w-4 h-4 text-white drop-shadow" />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <Mic className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )
          ) : links.length === 0 ? (
            <ListEmptyState
              icon={Link2}
              title="Нет ссылок"
              description="Ссылки из сообщений появятся здесь"
            />
          ) : (
            <ul className="space-y-1">
              {links.map((item, i) => (
                <li key={`${item.messageId}-${i}-${item.url}`}>
                  <button
                    type="button"
                    onClick={() => handleOpenLink(item.url)}
                    title={item.url}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary/70 text-sm text-primary truncate"
                  >
                    {item.url}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
