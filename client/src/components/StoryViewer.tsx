import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, MoreHorizontal, Heart, Send, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface Story {
  id: string | number;
  image: string;
  userName: string;
  userAvatar: string;
  time: string;
  authorId?: string;
}

interface StoryViewerProps {
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
  /** Вызывается при показе сториз (для записи просмотра). Передаётся id текущего сториз. */
  onStoryView?: (storyId: string) => void;
  /** Для своих сториз: открыть список просмотров */
  onOpenViewers?: (storyId: string) => void;
  canSeeViewers?: boolean;
  viewersCountByStoryId?: Record<string, number>;
  onReply?: (payload: { storyId: string; authorId: string; text: string }) => Promise<void> | void;
  canReply?: boolean;
}

export default function StoryViewer({
  stories,
  initialIndex = 0,
  onClose,
  onStoryView,
  onOpenViewers,
  canSeeViewers = false,
  viewersCountByStoryId = {},
  onReply,
  canReply = true,
}: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const s = stories[currentIndex];
    if (s && onStoryView && typeof s.id === "string" && s.id.length > 20) {
      onStoryView(s.id);
    }
  }, [currentIndex, stories, onStoryView]);

  // Auto-advance stories
  useEffect(() => {
    if (isPaused) return;

    const duration = 15000; // 15 seconds per story
    const interval = 50; // update every 50ms
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < stories.length - 1) {
            setCurrentIndex((c) => c + 1);
            return 0;
          } else {
            clearInterval(timer);
            onClose?.();
            return 100;
          }
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [currentIndex, stories.length, onClose, isPaused]);

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((c) => c + 1);
      setProgress(0);
    } else {
      onClose?.();
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex((c) => c - 1);
      setProgress(0);
    } else {
      setProgress(0);
    }
  };

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) {
      handlePrev(e);
    } else {
      handleNext(e);
    }
  };

  if (!stories.length) return null;
  const currentStory = stories[currentIndex];
  const currentStoryId = typeof currentStory?.id === "string" ? currentStory.id : null;
  const viewersCount = currentStoryId ? viewersCountByStoryId[currentStoryId] ?? 0 : 0;

  const handleReplySend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = replyText.trim();
    const storyId = typeof currentStory?.id === "string" ? currentStory.id : "";
    const authorId = currentStory?.authorId ?? "";
    if (!text || !storyId || !authorId || !onReply || sendingReply) return;
    setSendingReply(true);
    setReplyError(null);
    try {
      await onReply({ storyId, authorId, text });
      setReplyText("");
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Не удалось отправить ответ");
    } finally {
      setSendingReply(false);
    }
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    const text = replyText.trim();
    const storyId = typeof currentStory?.id === "string" ? currentStory.id : "";
    const authorId = currentStory?.authorId ?? "";
    if (!text || !storyId || !authorId || !onReply || sendingReply) return;
    setSendingReply(true);
    setReplyError(null);
    Promise.resolve(onReply({ storyId, authorId, text }))
      .then(() => setReplyText(""))
      .catch((err: unknown) => setReplyError(err instanceof Error ? err.message : "Не удалось отправить ответ"))
      .finally(() => setSendingReply(false));
  };

  const viewerNode = (
    <div 
      className="fixed inset-0 w-full max-w-[480px] mx-auto z-[320] bg-black text-white flex flex-col animate-in fade-in zoom-in-[0.98] duration-200"
      style={{ height: '100dvh' }}
    >
      
      {/* Progress Bars */}
      <div className="absolute top-0 inset-x-0 px-2 pt-safe-offset-2 flex gap-1 z-50">
        {stories.map((s, idx) => (
          <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-75 ease-linear"
              style={{ 
                width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? '100%' : '0%' 
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-0 inset-x-0 pt-safe-offset-6 px-4 pb-4 flex items-center justify-between z-50 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-2.5">
          <img 
            src={currentStory.userAvatar} 
            alt={currentStory.userName} 
            className="w-9 h-9 rounded-full object-cover border border-white/20"
          />
          <div className="flex items-center gap-2">
            <span className="font-medium text-[14px] shadow-sm">{currentStory.userName}</span>
            <span className="text-white/60 text-[13px]">{currentStory.time}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {canSeeViewers && currentStoryId && (
            <button
              type="button"
              className="p-1 hover:bg-white/20 rounded-full transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center gap-1.5"
              onClick={(e) => {
                e.stopPropagation();
                onOpenViewers?.(currentStoryId);
              }}
              aria-label="Кто посмотрел сториз"
            >
              <Eye className="w-5 h-5" />
              {viewersCount > 0 && <span className="text-xs">{viewersCount}</span>}
            </button>
          )}
          <button type="button" className="p-1 hover:bg-white/20 rounded-full transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center" aria-label="Ещё">
            <MoreHorizontal className="w-6 h-6" />
          </button>
          <button type="button" onClick={() => onClose?.()} className="p-1 hover:bg-white/20 rounded-full transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center" aria-label="Закрыть">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Image Content (tap areas) */}
      <div 
        className="flex-1 relative bg-zinc-900 w-full h-full flex items-center justify-center cursor-pointer"
        onClick={handleTap}
        onPointerDown={() => setIsPaused(true)}
        onPointerUp={() => setIsPaused(false)}
        onPointerLeave={() => setIsPaused(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <img 
          src={currentStory.image} 
          alt="Story content" 
          className="w-full h-full object-cover sm:object-contain select-none"
          draggable={false}
        />
      </div>

      {/* Footer Area */}
      <div className="absolute bottom-0 inset-x-0 pt-8 px-4 pb-[max(var(--uix-space-4),calc(env(safe-area-inset-bottom,0px)+var(--uix-space-2)))] flex items-center gap-4 bg-gradient-to-t from-black/80 to-transparent z-50">
        <div className="flex-1 relative">
          <input 
            type="text" 
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleReplyKeyDown}
            placeholder={canReply ? "Ответить..." : "Ответы недоступны"} 
            disabled={!canReply || sendingReply || !onReply}
            className="w-full bg-white/10 border border-white/20 rounded-full py-3 px-5 text-white placeholder:text-white/60 outline-none focus:bg-white/20 transition-colors"
            onClick={(e) => e.stopPropagation()}
          />
          {replyError && (
            <p className="absolute left-2 top-full mt-1 text-[11px] text-red-300">{replyError}</p>
          )}
        </div>
        <button type="button" className="p-3 rounded-full hover:bg-white/20 transition-colors flex-shrink-0 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center" onClick={(e) => e.stopPropagation()} aria-label="Нравится">
          <Heart className="w-7 h-7" />
        </button>
        <button
          type="button"
          className={cn(
            "p-3 rounded-full transition-colors flex-shrink-0 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center",
            !canReply || sendingReply || !replyText.trim() || !onReply
              ? "opacity-60 cursor-not-allowed bg-white/10"
              : "hover:bg-white/20"
          )}
          onClick={(e) => {
            void handleReplySend(e);
          }}
          aria-label="Отправить ответ"
          disabled={!canReply || sendingReply || !replyText.trim() || !onReply}
        >
          <Send className="w-7 h-7" />
        </button>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(viewerNode, document.body);
}
