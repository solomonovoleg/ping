import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronDown, Phone, Video, MoreVertical, Send, Paperclip, Mic, Smile, Square, Copy, Trash2, Edit3, CheckSquare, Share2, Reply, Camera, Image, X, Bookmark, BookmarkCheck, MessageCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/motion";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useCallContext } from "@/contexts/CallContext";
import { UserAvatar } from "@/components/UserAvatar";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { getMessages, uploadVoice, uploadChatMedia, sendMessage, addMessageReaction, REACTION_EMOJIS, saveMessage, unsaveMessage, isMessageSaved } from "@/lib/chat";
import { compressImage } from "@/lib/compress-image";
import { setDraft, clearDraft } from "@/lib/chat-drafts";
import { useToast } from "@/hooks/use-toast";

import { isNative, takePhotoFromCamera, pickPhotoFromGallery, triggerLightHaptic } from "@/lib/capacitor-native";
import { playSendSound } from "@/lib/send-sound";
import { LoadingProgress } from "@/components/ui/loading-progress";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { NAME_MAX_LENGTH } from "@shared/schema";
import type { ApiChat, ApiMessage } from "@/features/chat";
import { EMOJIS, formatLastSeen, buildMessageListItems } from "@/features/chat";
import { ChatMessageRow } from "@/features/chat/components/ChatMessageRow";
import { useChatMessages } from "@/features/chat/hooks/useChatMessages";
import { useSendMessage } from "@/features/chat/hooks/useSendMessage";
import { useMessageActions } from "@/features/chat/hooks/useMessageActions";
import { AI_CHAT_ID } from "@/features/chat/constants";
import { useAiChat } from "@/features/chat/hooks/useAiChat";
import { formatMessageTime } from "@/features/chat/utils/format";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { useIsMobile } from "@/hooks/use-mobile";

type ChatPlatformKind = "ios" | "android" | "web";

function detectChatPlatform(): ChatPlatformKind {
  if (!isNative()) return "web";
  try {
    const maybeCap = window as unknown as { Capacitor?: { getPlatform?: () => string } };
    const platform = maybeCap.Capacitor?.getPlatform?.();
    if (platform === "ios" || platform === "android") return platform;
  } catch {
    // fallback to web-like spacing
  }
  return "web";
}

function useChatSpacingPreset() {
  const isMobile = useIsMobile();
  const [platform, setPlatform] = useState<ChatPlatformKind>("web");

  useEffect(() => {
    setPlatform(detectChatPlatform());
  }, []);

  const isDesktopWeb = platform === "web" && !isMobile;
  const isIos = platform === "ios";
  const isAndroid = platform === "android";

  return {
    headerYClass: isDesktopWeb ? "py-3.5" : isAndroid ? "py-2.5" : isIos ? "py-3.5" : "py-3",
    bottomBarYClass: isDesktopWeb ? "py-3" : isAndroid ? "py-2" : isIos ? "py-2.5" : "py-2.5",
    messageTopPaddingClass: isDesktopWeb ? "pt-6" : isAndroid ? "pt-3.5" : "pt-4",
    aiListBottomPad: isDesktopWeb
      ? "calc(12rem + env(safe-area-inset-bottom,0px))"
      : isAndroid
        ? "calc(10.5rem + env(safe-area-inset-bottom,0px))"
        : "calc(11rem + env(safe-area-inset-bottom,0px))",
    chatListBottomPad: isDesktopWeb
      ? "calc(104px + env(safe-area-inset-bottom,0px))"
      : isAndroid
        ? "calc(92px + env(safe-area-inset-bottom,0px))"
        : "calc(98px + env(safe-area-inset-bottom,0px))",
  };
}

/** Экран чата с ИИ (AI OVER): список сообщений, ввод текста, подгрузка контекста */
function AIChatView() {
  const [, setLocation] = useLocation();
  const ai = useAiChat();
  const [input, setInput] = useState("");
  const { toast } = useToast();
  const spacing = useChatSpacingPreset();

  const handleSend = async () => {
    const text = input.trim();
    if (!text || ai.sending) return;
    setInput("");
    const ok = await ai.send(text);
    if (!ok) toast({ title: "Не удалось отправить", variant: "destructive" });
  };

  return (
    <div className="absolute inset-0 z-[100] flex h-full w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-[radial-gradient(circle_at_top_right,hsl(var(--muted))_0%,hsl(var(--background))_56%,white_100%)] pb-[var(--uix-nav-bottom)] uix-screen">
      <header className={cn("uix-content-x sticky top-0 z-20 flex items-center justify-between border-b border-indigo-500/15 bg-white/70 shadow-[0_12px_40px_rgba(70,71,211,0.08)] backdrop-blur-xl pt-safe-offset-2 dark:bg-slate-900/70", spacing.headerYClass)}>
        <div className="flex min-w-0 items-center gap-2.5">
          <TapScaleButton
            type="button"
            onClick={() => setLocation("/")}
            className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] rounded-full p-2 text-indigo-600 transition-colors hover:bg-slate-100/60 dark:text-indigo-300 dark:hover:bg-slate-800/60"
            aria-label="Назад к чатам"
          >
            <ChevronLeft className="h-6 w-6" />
          </TapScaleButton>
          <img
            src="/ai-over-avatar.png"
            alt="AI OVER"
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-indigo-500/35"
          />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold tracking-tight text-indigo-700 dark:text-indigo-300">Atmospheric AI</p>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              <span className="truncate text-[12px] font-medium text-muted-foreground">в сети</span>
            </div>
          </div>
        </div>
        <TapScaleButton
          type="button"
          className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100/60 dark:text-slate-400 dark:hover:bg-slate-800/60"
          aria-label="Меню AI чата"
        >
          <MoreVertical className="h-5 w-5" />
        </TapScaleButton>
      </header>

      <main
        ref={ai.scrollContainerRef}
        className={cn("uix-content-x flex-1 min-h-0 overflow-y-auto overflow-x-hidden", spacing.messageTopPaddingClass)}
        style={{ WebkitOverflowScrolling: "touch", paddingBottom: spacing.aiListBottomPad }}
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <div className="flex justify-center">
            <span className="rounded-full bg-muted/80 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Сегодня</span>
          </div>
          {ai.loading ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" aria-label="Загрузка истории AI чата" />
            </div>
          ) : ai.error ? (
            <ErrorWithRetry
              title="Не удалось загрузить AI чат"
              description={ai.error}
              onRetry={() => ai.refetch()}
              className="min-h-[220px] border-none bg-transparent"
            />
          ) : ai.messages.length === 0 ? (
            <ListEmptyState
              icon={Sparkles}
              title="Диалог пока пуст"
              description="Задайте первый вопрос, и AI сразу начнёт отвечать."
              actionLabel="Начать диалог"
              onAction={() => ai.refetch()}
              className="min-h-[240px] border-none bg-transparent"
            />
          ) : (
            <>
              {ai.hasMore && (
                <div className="flex justify-center">
                  <TapScaleButton
                    type="button"
                    onClick={ai.loadMore}
                    disabled={ai.loadMoreLoading}
                    className="rounded-full bg-indigo-500/10 px-3 py-1.5 text-sm text-indigo-600 transition-colors hover:bg-indigo-500/15 dark:text-indigo-300"
                  >
                    {ai.loadMoreLoading ? "Загрузка..." : "Подгрузить ещё"}
                  </TapScaleButton>
                </div>
              )}
              {ai.messages.map((msg) => (
                <div key={msg.id} className={cn("flex flex-col max-w-[85%] gap-1.5", msg.role === "user" ? "ml-auto items-end" : "items-start")}>
                  <div
                    className={cn(
                      "relative rounded-2xl px-5 py-4 text-[15px] leading-relaxed shadow-[0_4px_20px_rgba(70,71,211,0.06)]",
                      msg.role === "user"
                        ? "rounded-tr-none bg-indigo-600 text-white shadow-[0_8px_30px_rgba(70,71,211,0.18)]"
                        : "rounded-tl-none border border-indigo-500/10 bg-white/80 text-foreground backdrop-blur-sm dark:bg-slate-900/70"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <div className="px-1">
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{formatMessageTime(msg.createdAt)}</span>
                  </div>
                </div>
              ))}
              {ai.sending && (
                <div className="flex items-center gap-3 px-1">
                  <div className="flex gap-1.5 rounded-full bg-muted/70 p-3">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 [animation-delay:200ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 [animation-delay:400ms]" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">AI думает</span>
                </div>
              )}
              <div ref={ai.messagesEndRef} />
            </>
          )}
        </div>
      </main>

      <section className={cn("uix-content-x absolute inset-x-0 bottom-[var(--uix-nav-bottom)] z-20 pb-4 pb-safe", spacing.bottomBarYClass)}>
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex items-end gap-2 rounded-3xl border border-white/30 bg-white/75 p-2 shadow-[0_12px_40px_rgba(70,71,211,0.12)] backdrop-blur-2xl dark:border-slate-700/40 dark:bg-slate-900/80">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Введите сообщение..."
              className="min-h-[44px] max-h-28 w-full resize-none bg-transparent px-3 py-2 text-base md:text-[15px] text-foreground outline-none placeholder:text-slate-400"
              rows={1}
              disabled={ai.sending}
            />
            <TapScaleButton
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || ai.sending}
              haptic
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-indigo-400 text-white shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110 disabled:opacity-50"
              aria-label="Отправить в AI чат"
            >
              <Send className="h-5 w-5 translate-x-[-1px]" />
            </TapScaleButton>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Полоса записи голоса: волна уровня, градиент, мягкое свечение, анимация появления */
function RecordingStrip({ durationSec, onStop }: { durationSec: number; onStop: () => void }) {
  const reduced = usePrefersReducedMotion();
  const m = Math.floor(durationSec / 60);
  const s = Math.floor(durationSec % 60);
  const timeStr = `${m}:${String(s).padStart(2, "0")}`;
  const bars = 7;
  return (
    <motion.div
      className="mb-2 overflow-hidden rounded-2xl border border-red-400/40 bg-gradient-to-r from-red-500/20 via-rose-500/15 to-red-600/25 dark:from-red-600/25 dark:via-rose-600/20 dark:to-red-700/30 shadow-[0_0_24px_-4px_rgba(239,68,68,0.35)] dark:shadow-[0_0_28px_-4px_rgba(239,68,68,0.4)]"
      initial={reduced ? false : { opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="flex items-center gap-3 py-3 px-4">
        {/* Анимированная волна уровня */}
        <div className="flex items-end gap-0.5 h-5" aria-hidden>
          {Array.from({ length: bars }).map((_, i) => (
            <motion.span
              key={i}
              className="w-0.5 rounded-full bg-red-500 dark:bg-red-400 origin-bottom"
              animate={
                reduced
                  ? { scaleY: 0.6 }
                  : {
                      scaleY: [0.4, 0.9, 0.5, 0.85, 0.4],
                      transition: {
                        duration: 0.9,
                        repeat: Infinity,
                        delay: i * 0.08,
                        ease: "easeInOut",
                      },
                    }
              }
              style={{ height: "100%" }}
            />
          ))}
        </div>
        {/* Пульсирующая точка */}
        <span className="relative flex h-3 w-3 flex-shrink-0" aria-hidden>
          {!reduced && (
            <motion.span
              className="absolute inset-0 rounded-full bg-red-500 dark:bg-red-400"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 dark:bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
        </span>
        <span className="text-sm font-semibold tabular-nums text-red-700 dark:text-red-300 min-w-[2.5rem]">
          {timeStr}
        </span>
        <TapScaleButton
          type="button"
          onClick={onStop}
          haptic
          className="ml-auto px-4 py-2 rounded-xl bg-red-500 dark:bg-red-600 text-white text-sm font-semibold shadow-[0_2px_10px_rgba(239,68,68,0.4)] hover:bg-red-600 dark:hover:bg-red-700 active:shadow-inner transition-colors"
          aria-label="Остановить запись"
        >
          Стоп
        </TapScaleButton>
      </div>
    </motion.div>
  );
}

/**
 * Страница чата. Контракт (чтобы не сломать):
 * - Обязательны три хука: useChatMessages → useSendMessage → useMessageActions.
 * - Всё про ввод/отправку — только send.* (send.editingId, send.message, send.setMessage и т.д.).
 * - Всё про меню сообщения и действия — только actions.* (actions.messageMenu, actions.setMessageMenu и т.д.).
 * - Не использовать голые editingId, message, setMessage и т.п. Подробнее: docs/CHAT_DETAIL_RULES.md
 */
export default function ChatDetail({ params: paramsProp }: { params?: { id: string } }) {
  const [, setLocation] = useLocation();
  const paramsFromRoute = useParams<{ id?: string }>();
  // Подстраховка: id из URL, если useParams ещё не отдал (lazy/гидрация)
  const fromPath =
    typeof window !== "undefined"
      ? (window.location.pathname.match(/^\/chat\/([^/?#]+)/)?.[1] ?? "")
      : "";
  const chatIdParam = (paramsProp?.id ?? paramsFromRoute?.id ?? fromPath) ?? "";
  const { user } = useAuth();
  const spacing = useChatSpacingPreset();
  if (chatIdParam === AI_CHAT_ID) return <AIChatView />;

  const sendDraftRef = useRef<{ setMessage: (v: string | ((p: string) => string)) => void } | null>(null);
  const {
    chatId,
    chat,
    setChat,
    messages,
    setMessages,
    loading,
    error,
    setError,
    hasMoreMessages,
    loadingMoreMessages,
    loadChatAndMessages,
    loadOlderMessages,
    scrollContainerRef,
    messagesEndRef,
    typingDisplay,
    voiceRecordingDisplay,
    scheduleSendTyping,
  } = useChatMessages({
    chatIdParam,
    onDraftRestore: (_, draft) => {
      sendDraftRef.current?.setMessage(draft);
      setDraftRestoredHint(!!draft.trim());
    },
  });

  const send = useSendMessage({ chatId, setMessages, user });
  sendDraftRef.current = send;

  const actions = useMessageActions({
    chatId,
    messages,
    setMessages,
    user,
    onEdit: (msg) => {
      if (msg.type === "text") {
        send.setEditingId(msg.id);
        send.setMessage(msg.content);
      }
    },
  });

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachSource, setShowAttachSource] = useState(false);
  const [draftRestoredHint, setDraftRestoredHint] = useState(false);
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unseenIncomingCount, setUnseenIncomingCount] = useState(0);
  const attachSourceRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageIdRef = useRef<string>("");
  const { startCall } = useCallContext();

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const top = Math.max(0, el.scrollHeight - el.clientHeight);
    if (smooth) el.scrollTo({ top, behavior: "smooth" });
    else el.scrollTop = top;
    setUnseenIncomingCount(0);
    setIsNearBottom(true);
  }, [scrollContainerRef]);

  const syncComposerHeight = useCallback(() => {
    const el = messageInputRef.current;
    if (!el) return;
    const minHeight = 38;
    const maxHeight = 112;
    el.style.height = "auto";
    const nextHeight = Math.max(minHeight, Math.min(el.scrollHeight, maxHeight));
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    if (!loading) {
      setLoadingSlow(false);
      return;
    }
    const t = setTimeout(() => setLoadingSlow(true), 8000);
    return () => clearTimeout(t);
  }, [loading]);

  const handleOpenMessageMenu = useCallback((msg: ApiMessage, rect: DOMRect) => {
    actions.setMessageMenu({ msg, x: rect.left, y: rect.bottom + 4 });
    setShowEmojiPicker(false);
  }, [actions.setMessageMenu]);

  useEffect(() => {
    if (actions.messageMenu) setShowEmojiPicker(false);
  }, [actions.messageMenu]);

  useEffect(() => {
    if (messages.length === 0) return;
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const messageIdFromUrl = params?.get("messageId");
    if (!messageIdFromUrl) return;
    const el = document.querySelector(`[data-message-id="${messageIdFromUrl}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [messages]);

  useEffect(() => {
    if (!showAttachSource) return;
    const onPointerDown = (e: PointerEvent) => {
      if (attachSourceRef.current?.contains(e.target as Node)) return;
      setShowAttachSource(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showAttachSource]);

  useEffect(() => {
    if (!chatId || loading) return;
    const t = setTimeout(() => setDraft(chatId, send.message), 400);
    return () => clearTimeout(t);
  }, [chatId, send.message, loading]);

  useEffect(() => {
    if (loading || !chat) return;
    const t = setTimeout(() => messageInputRef.current?.focus({ preventScroll: true }), 300);
    return () => clearTimeout(t);
  }, [loading, chat?.id]);

  useEffect(() => {
    syncComposerHeight();
  }, [send.message, send.editingId, syncComposerHeight]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (!lastMessageIdRef.current) {
      lastMessageIdRef.current = last.id;
      return;
    }
    if (last.id === lastMessageIdRef.current) return;
    lastMessageIdRef.current = last.id;
    if (isNearBottom) {
      setUnseenIncomingCount(0);
      return;
    }
    if (last.senderId !== user?.id) {
      setUnseenIncomingCount((prev) => prev + 1);
    }
  }, [messages, isNearBottom, user?.id]);

  useEffect(() => {
    setUnseenIncomingCount(0);
    setIsNearBottom(true);
    lastMessageIdRef.current = "";
  }, [chatId]);

  const displayName = chat?.name ?? (chat?.otherMember ? [chat.otherMember.displayName, chat.otherMember.surname].filter(Boolean).join(" ") : null) ?? "Диалог";
  /** Имя для однострочного отображения (плейсхолдер, шапка): макс. 12 символов, чтобы не заезжало на кнопки */
  const displayNameShort =
    displayName && displayName !== "Диалог"
      ? (displayName.length > NAME_MAX_LENGTH ? displayName.slice(0, NAME_MAX_LENGTH) + "…" : displayName)
      : null;
  const callerDisplayName = user ? [user.displayName, user.surname].filter(Boolean).join(" ") || user.phone || "Абонент" : "Абонент";

  const isDm = chat?.type === "dm";
  const messageListItems = useMemo(() => buildMessageListItems(messages), [messages]);

  if (loading) {
    return (
      <div className="absolute inset-0 z-[100] flex h-full w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-[radial-gradient(circle_at_top_right,hsl(var(--muted))_0%,hsl(var(--background))_56%,white_100%)] pb-[var(--uix-nav-bottom)] uix-screen">
        <div className={cn("uix-content-x sticky top-0 z-20 flex items-center gap-2 border-b border-indigo-500/15 bg-white/70 shadow-[0_12px_40px_rgba(70,71,211,0.08)] backdrop-blur-xl pt-safe-offset-2 dark:bg-slate-900/70", spacing.headerYClass)}>
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors flex items-center flex-shrink-0 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]"
            aria-label="Назад к чатам"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="min-w-0 flex-1 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted/70 rounded mt-1" />
            </div>
          </div>
        </div>
        {loadingSlow && (
          <div className="shrink-0 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between gap-2">
            <span className="text-sm text-amber-700 dark:text-amber-400">Загрузка занимает больше времени, чем обычно</span>
            <button
              type="button"
              onClick={() => loadChatAndMessages()}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-200 text-sm font-medium min-h-[var(--uix-touch-min)]"
            >
              Повторить
            </button>
          </div>
        )}
        <LoadingProgress loading className="flex-1 min-h-0" minHeight="240px">
          <div className="flex min-h-[240px] flex-1 flex-col gap-3 overflow-y-auto p-4" />
        </LoadingProgress>
      </div>
    );
  }

  if (error || !chat) {
    if (import.meta.env.DEV && (typeof send === "undefined" || typeof actions === "undefined")) {
      throw new Error("ChatDetail: send или actions не определены. Не удаляй useSendMessage и useMessageActions. См. docs/CHAT_DETAIL_RULES.md");
    }
    return (
      <div className="flex flex-col h-full bg-background absolute inset-0 z-[100] items-center justify-center text-muted-foreground p-4 gap-4 uix-screen">
        <p className="text-center">{error ?? "Чат не найден"}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={loadChatAndMessages}
            className="min-h-[var(--uix-touch-min)] px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 active:scale-[0.98] transition-transform duration-100"
          >
            Повторить
          </button>
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="min-h-[var(--uix-touch-min)] px-4 py-2 rounded-xl bg-secondary text-foreground font-medium hover:opacity-90 active:scale-[0.98] transition-transform duration-100"
          >
            Вернуться к чатам
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[100] flex h-full w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-[radial-gradient(circle_at_top_right,hsl(var(--muted))_0%,hsl(var(--background))_56%,white_100%)] pb-[var(--uix-nav-bottom)] uix-screen">
      {/* Header */}
      <div className={cn("uix-content-x sticky top-0 z-20 flex items-center gap-2 border-b border-indigo-500/15 bg-white/70 shadow-[0_12px_40px_rgba(70,71,211,0.08)] backdrop-blur-xl pt-safe-offset-2 dark:bg-slate-900/70", spacing.headerYClass)}>
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors flex items-center flex-shrink-0 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] sm:min-w-0"
          aria-label="Назад к чатам"
        >
          <ChevronLeft className="w-6 h-6" />
          <span className="text-[17px] hidden sm:inline">Назад</span>
        </button>
        <button
          type="button"
          onClick={() => chat.type === "dm" && chat.otherMember && setLocation(`/profile/${chat.otherMember.publicId ?? chat.otherMember.id}`)}
          className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden text-left rounded-lg hover:bg-primary/5 active:bg-primary/10 transition-colors -mx-1 px-1 py-1"
          title={chat.type === "dm" && chat.otherMember ? "Открыть профиль" : undefined}
          aria-label={chat.type === "dm" && chat.otherMember ? `Профиль: ${displayName}` : undefined}
        >
          <UserAvatar
            avatarUrl={chat.otherMember?.avatarUrl}
            displayName={displayName}
            seed={chat.otherMember?.id ?? chat.id}
            size={40}
            className="w-10 h-10 rounded-full flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[16px] leading-tight truncate">{displayNameShort ?? displayName}</p>
            <p className="text-muted-foreground text-[13px] leading-tight truncate">
              {chat.type === "dm"
                ? (formatLastSeen(chat.otherMember?.lastSeenAt ?? null) ?? "не в сети")
                : "группа"}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {chat.type === "dm" && chat.otherMember && (
            <>
              <button
                type="button"
                className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
                onClick={() => startCall(chat.otherMember!.id, callerDisplayName, chatId, false)}
                aria-label="Аудиозвонок"
              >
                <Phone className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
                onClick={() => startCall(chat.otherMember!.id, callerDisplayName, chatId, true)}
                aria-label="Видеозвонок"
              >
                <Video className="w-5 h-5" />
              </button>
            </>
          )}
          <button
            type="button"
            className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Ещё"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Панель выбранных сообщений */}
      {actions.selectedIds.size > 0 && (
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2 bg-primary/10 border-b border-border">
          <span className="text-sm font-medium">Выбрано: {actions.selectedIds.size}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={actions.handleForwardSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              <Share2 className="w-4 h-4" />
              Переслать
            </button>
            <button type="button" onClick={actions.handleClearSelection} className="px-3 py-1.5 rounded-lg bg-secondary text-sm">
              Снять выбор
            </button>
          </div>
        </div>
      )}

      {/* Messages: min-h-0 чтобы flex дал высоту; -webkit-overflow-scrolling: touch для инерции на iOS; overscroll для предсказуемого скролла */}
      <div
        ref={scrollContainerRef}
        className={cn("uix-content-x-tight flex flex-1 min-h-0 flex-col gap-0 overflow-y-auto overflow-x-hidden overscroll-y-auto touch-pan-y", spacing.messageTopPaddingClass)}
        style={{
          overflowAnchor: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: spacing.chatListBottomPad,
        }}
        onScroll={() => {
          const el = scrollContainerRef.current;
          if (!el) return;
          const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
          const near = distanceToBottom < 120;
          setIsNearBottom(near);
          if (near) setUnseenIncomingCount(0);
          if (loadingMoreMessages || !hasMoreMessages || messages.length === 0) return;
          const oldest = messages[0];
          if (oldest?.id.startsWith("temp-")) return;
          if (el.scrollTop < 80) loadOlderMessages();
        }}
      >
        {loadingMoreMessages && (
          <div className="flex justify-center py-2">
            <span className="text-xs text-muted-foreground">Загрузка…</span>
          </div>
        )}
        {messages.length === 0 && !loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-muted/80 flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="font-medium text-foreground">Нет сообщений</p>
              <p className="text-sm text-muted-foreground mt-1">Напишите первое сообщение или отправьте голосовое</p>
            </div>
          </div>
        )}
        {messageListItems.map((item, idx) => {
          if (item.type === "date") {
            return (
              <p key={`date-${item.label}-${idx}`} className="sticky top-2 z-[1] mx-auto rounded-full bg-muted/70 px-3 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-sm">
                {item.label}
              </p>
            );
          }
          const { msg, isFirstInGroup, isLastInGroup } = item;
          const isMe = msg.senderId === user?.id;
          const senderName = isMe ? "Вы" : displayName;
          const showSenderName = !isDm;
          if (msg.type === "missed_call") {
            let payload: { callerId?: string; calleeId?: string; video?: boolean } = {};
            try {
              payload = JSON.parse(msg.content);
            } catch {}
            const callerId = payload.callerId ?? "";
            const calleeId = payload.calleeId ?? "";
            const video = payload.video ?? false;
            const iAmCallee = user?.id === calleeId;
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <div className="bg-secondary/50 text-muted-foreground text-[12px] px-4 py-2 rounded-xl flex flex-col items-center gap-2">
                  <span>{iAmCallee ? "Пропущенный звонок" : "Звонок не принят"}</span>
                  {iAmCallee && callerId && (
                    <button
                      type="button"
                      className="text-primary font-medium hover:underline"
                      onClick={() => startCall(callerId, displayName, chatId, video)}
                    >
                      Перезвонить
                    </button>
                  )}
                </div>
              </div>
            );
          }
          if (msg.type === "system") {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <span className="bg-secondary/50 text-muted-foreground text-[11px] px-3 py-1 rounded-full text-center">
                  {msg.content}
                </span>
              </div>
            );
          }
          return (
            <ChatMessageRow
              key={msg.id}
              msg={msg}
              isFirstInGroup={isFirstInGroup}
              isLastInGroup={isLastInGroup}
              isMe={isMe}
              isDm={isDm}
              senderName={senderName}
              otherMemberAvatarUrl={chat.otherMember?.avatarUrl ?? null}
              otherMemberId={chat.otherMember?.id ?? chat.id}
              lastReadAt={chat.otherMember?.lastReadAt ?? null}
              currentUserId={user?.id ?? ""}
              currentUserAvatarUrl={user?.avatarUrl ?? null}
              currentUserDisplayName={user?.displayName ?? "Вы"}
              isSelected={actions.selectedIds.has(msg.id)}
              isHighlighted={actions.highlightedMessageId === msg.id}
              isShattering={actions.shatteringMessageId === msg.id}
              showFooter={send?.editingId !== msg.id}
              onPointerDown={actions.handleMessagePointerDown}
              onPointerUp={actions.handleMessagePointerUp}
              onPointerLeave={actions.handleMessagePointerLeave}
              onContextMenu={actions.handleMessageContextMenu}
              onOpenMenu={handleOpenMessageMenu}
              onRetry={send.handleRetryFailedMessage}
              onQuickReply={(targetMsg) => {
                send.setReplyingTo(targetMsg);
                setDraftRestoredHint(false);
                requestAnimationFrame(() => {
                  messageInputRef.current?.focus({ preventScroll: true });
                });
              }}
              onScrollToReply={actions.scrollToMessageAndHighlight}
              onShatterComplete={actions.handleShatterComplete}
              onOpenProfile={(id) => setLocation(`/profile/${id}`)}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {!isNearBottom && (
        <div className="pointer-events-none absolute inset-x-0 z-[108]" style={{ bottom: "calc(var(--uix-nav-bottom) + 4.25rem)" }}>
          <div className="uix-content-x mx-auto flex w-full max-w-4xl justify-end">
            <TapScaleButton
              type="button"
              haptic
              onClick={() => scrollToBottom(true)}
              className="pointer-events-auto inline-flex min-h-[var(--uix-touch-min)] items-center gap-1.5 rounded-full border border-border/80 bg-background/95 px-3 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur"
              aria-label="Прокрутить вниз к новым сообщениям"
            >
              <ChevronDown className="h-4 w-4" />
              <span>{unseenIncomingCount > 0 ? `Новые: ${unseenIncomingCount}` : "Вниз"}</span>
            </TapScaleButton>
          </div>
        </div>
      )}

      {/* Контекстное меню сообщения — в портале поверх всего, с умным позиционированием и мягкой анимацией */}
      {actions.messageMenu && (() => {
        const menu = actions.messageMenu;
        const left = Math.min(Math.max(menu.x - 8, 12), window.innerWidth - 212);
        const menuHeightEstimate = 280;
        const bottomSpace = 160;
        const openAbove = menu.y + menuHeightEstimate > window.innerHeight - bottomSpace;
        const top = openAbove ? undefined : menu.y - 10;
        const bottom = openAbove ? window.innerHeight - menu.y + 10 : undefined;
        const menuContent = (
          <div
            ref={actions.messageMenuRef}
            className="fixed min-w-[200px] max-h-[min(280px,60vh)] overflow-y-auto py-1 bg-background/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-xl"
            style={{
              left,
              ...(openAbove ? { bottom } : { top }),
              zIndex: 9999,
              animation: "messageMenuIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both",
            }}
          >
            <style>{`
              @keyframes messageMenuIn {
                from { opacity: 0; transform: scale(0.96) translateY(4px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
              }
            `}</style>
            <div className="divide-y divide-border/40 [&>*:first-child]:rounded-t-xl [&>*:last-child]:rounded-b-xl">
              <button
                type="button"
                onClick={() => {
                  send.setReplyingTo(menu.msg);
                  messageInputRef.current?.focus();
                  actions.closeMenu();
                }}
                className="w-full flex items-center gap-3 px-4 min-h-[var(--uix-touch-min,44px)] py-2.5 text-left text-sm hover:bg-secondary/80 active:bg-secondary/60 transition-colors rounded-none"
              >
                <Reply className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                Ответить
              </button>
              <div className="px-2 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground px-2 mb-1.5">Реакция</p>
                <div className="flex flex-wrap gap-1">
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="min-w-[var(--uix-touch-min,44px)] min-h-[var(--uix-touch-min,44px)] flex items-center justify-center rounded-xl hover:bg-secondary/80 active:bg-secondary/60 text-xl transition-colors"
                      onClick={() => actions.handleReaction(menu.msg, emoji)}
                      title={`Реакция ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => actions.handleCopy(menu.msg)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-secondary/80 transition-colors rounded-none"
              >
                <Copy className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                Скопировать
              </button>
              <button
                type="button"
                onClick={() => actions.handleForward(menu.msg)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-secondary/80 transition-colors rounded-none"
              >
                <Share2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                Переслать
              </button>
              {actions.messageSavedMap[menu.msg.id] ? (
                <button
                  type="button"
                  onClick={() => actions.handleUnsaveMessage(menu.msg)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-secondary/80 transition-colors rounded-none"
                >
                  <BookmarkCheck className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  Убрать из избранного
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => actions.handleSaveMessage(menu.msg)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-secondary/80 transition-colors rounded-none"
                >
                  <Bookmark className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  Сохранить в избранное
                </button>
              )}
              <button
                type="button"
                onClick={() => actions.handleSelect(menu.msg)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-secondary/80 transition-colors rounded-none"
              >
                <CheckSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                Выбрать
              </button>
              {menu.msg.senderId === user?.id && (
                <>
                  {menu.msg.type === "text" && (
                    <button
                      type="button"
                      onClick={() => actions.handleEdit(menu.msg)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-secondary/80 transition-colors rounded-none"
                    >
                      <Edit3 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      Редактировать
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => actions.handleDelete(menu.msg)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors rounded-none"
                  >
                    <Trash2 className="w-4 h-4 flex-shrink-0" />
                    Удалить у всех
                  </button>
                </>
              )}
            </div>
          </div>
        );
        return createPortal(menuContent, document.body);
      })()}

      {/* Модалка выбора чата для пересылки */}
      {actions.forwardingMessage &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/50 flex flex-col items-center justify-center p-4"
            onClick={() => actions.setForwardingMessage(null)}
          >
            <div
              className="bg-background rounded-2xl shadow-xl max-w-[400px] w-full max-h-[70vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-lg">Переслать в чат</h3>
                <button
                  type="button"
onClick={() => actions.setForwardingMessage(null)}
              className="p-2 rounded-full hover:bg-secondary"
                  aria-label="Закрыть"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ul className="overflow-y-auto flex-1 py-2">
                {actions.forwardChatsFiltered.length === 0 ? (
                  <li className="px-4 py-3 text-muted-foreground text-sm">Нет других чатов</li>
                ) : (
                  actions.forwardChatsFiltered.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => actions.handleForwardToChat(c.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/80 transition-colors"
                      >
                        <span className="font-medium truncate">{c.name ?? (c.type === "dm" ? "Диалог" : "Чат")}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>,
          document.body
        )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="absolute bottom-[80px] right-4 bg-background/95 backdrop-blur-xl border border-border/50 shadow-lg rounded-2xl p-3 z-[110] w-[300px] animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-sm font-medium text-muted-foreground">Эмодзи</span>
            <button type="button" onClick={() => setShowEmojiPicker(false)} className="text-muted-foreground hover:text-foreground transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center" aria-label="Закрыть выбор эмодзи">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {EMOJIS.map((emo) => (
              <button
                key={emo}
                onClick={() => {
                  send.setMessage((prev) => prev + emo);
                  setShowEmojiPicker(false);
                }}
                className="text-2xl hover:bg-secondary rounded-lg p-1 transition-colors flex items-center justify-center"
              >
                {emo}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input — как в ВК: при редактировании тот же поле ввода, отправка = сохранить */}
      <div className={cn("uix-content-x relative z-[105] border-t border-indigo-500/15 bg-white/65 backdrop-blur-2xl pb-safe dark:bg-slate-900/75", spacing.bottomBarYClass)}>
        {send?.editingId && (
          <div className="flex items-center justify-between gap-2 mb-1.5 px-1">
            <span className="text-xs text-muted-foreground">Редактирование сообщения</span>
            <button type="button" onClick={send.handleCancelEdit} className="text-xs text-primary hover:underline">
              Отмена
            </button>
          </div>
        )}
        {(typingDisplay || voiceRecordingDisplay) && !send?.editingId && (
          <div className="text-xs text-muted-foreground mb-1 space-y-0.5">
            {typingDisplay && <p className="animate-pulse">{typingDisplay} печатает...</p>}
            {voiceRecordingDisplay && <p className="animate-pulse">{voiceRecordingDisplay} записывает голосовое...</p>}
          </div>
        )}
        {/* Полоса записи: волшебный вид с волной, градиентом и мягким свечением */}
        {send?.voiceState === "recording" && (
          <RecordingStrip
            durationSec={send.durationSec ?? 0}
            onStop={send.handleMicClick}
          />
        )}
        <input
          ref={send.fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="sr-only"
          aria-label="Прикрепить фото или видео"
          onChange={send.handleAttachFile}
        />
        <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-0 overflow-hidden">
          {send.replyingTo && (
            <div className="flex items-center gap-2 pl-3 pr-1 py-2 bg-muted/70 border-b border-border text-[var(--uix-text-caption)] rounded-t-xl">
              <Reply className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden />
              <span className="flex-1 min-w-0 truncate text-muted-foreground">
                {send.replyingTo.type === "text" ? send.replyingTo.content.slice(0, 60) + (send.replyingTo.content.length > 60 ? "…" : "") : "Сообщение"}
              </span>
              <button
                type="button"
                onClick={() => send.setReplyingTo(null)}
                className="flex-shrink-0 min-w-[var(--uix-touch-min,44px)] min-h-[var(--uix-touch-min,44px)] flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                aria-label="Отменить ответ"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {draftRestoredHint && (
            <div className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-primary/10 border-b border-primary/20 text-[var(--uix-text-caption)] rounded-t-xl">
              <span className="flex-1 text-muted-foreground">Черновик восстановлен</span>
              <button
                type="button"
                onClick={() => setDraftRestoredHint(false)}
                className="flex-shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                aria-label="Скрыть"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        <div className="relative flex min-w-0 items-end gap-1.5 overflow-hidden rounded-3xl border border-white/30 bg-white/75 p-1.5 shadow-[0_10px_32px_rgba(70,71,211,0.12)] dark:border-slate-700/40 dark:bg-slate-900/80">
          {showAttachSource && isNative() && (
            <div
              ref={attachSourceRef}
              className="absolute bottom-full left-0 mb-1 flex flex-col rounded-lg border border-border bg-background shadow-lg py-1 z-[110]"
            >
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary w-full"
                onClick={() => send.handleAttachFromNative("camera")}
              >
                <Camera className="w-4 h-4" />
                Камера
              </button>
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary w-full"
                onClick={() => send.handleAttachFromNative("gallery")}
              >
                <Image className="w-4 h-4" />
                Галерея
              </button>
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary w-full border-t border-border"
                onClick={() => { setShowAttachSource(false); send.fileInputRef.current?.click(); }}
              >
                <Paperclip className="w-4 h-4" />
                Файл (фото/видео)
              </button>
            </div>
          )}
          <TapScaleButton
            type="button"
            disabled={send.sendingMedia}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isNative()) setShowAttachSource((v) => !v);
              else send.fileInputRef.current?.click();
            }}
            className="flex min-h-[var(--uix-touch-min,44px)] min-w-[var(--uix-touch-min,44px)] flex-shrink-0 items-center justify-center rounded-full p-2.5 text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
            aria-label="Прикрепить фото или видео"
          >
            <Paperclip className="w-5 h-5 pointer-events-none" />
          </TapScaleButton>
          <div className="flex flex-1 min-w-0 items-end overflow-hidden rounded-2xl border border-border/40 bg-secondary/70 dark:bg-slate-800/60">
            <textarea
              ref={messageInputRef}
              value={send.message}
              onChange={(e) => {
                send.setMessage(e.target.value);
                setDraftRestoredHint(false);
                if (!send?.editingId) scheduleSendTyping();
                requestAnimationFrame(syncComposerHeight);
              }}
              onFocus={() => setDraftRestoredHint(false)}
              onKeyDown={send.handleKeyPress}
              placeholder={
                send?.editingId
                  ? "Измените текст и нажмите отправить"
                  : displayNameShort
                    ? `Сообщение для ${displayNameShort}`
                    : "Сообщение..."
              }
              className="max-h-28 min-h-[38px] w-0 flex-1 resize-none overflow-x-auto border-none bg-transparent py-2.5 pl-3 pr-1 text-base leading-5 outline-none focus:ring-0"
              rows={1}
            />
            <TapScaleButton
              type="button"
              haptic
              className={cn(
                "flex-shrink-0 rounded-full p-2 transition-all duration-150",
                showEmojiPicker ? "bg-primary/10 text-primary scale-105" : "text-muted-foreground hover:text-primary hover:bg-primary/5"
              )}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              aria-label="Эмодзи"
            >
              <Smile className="w-4 h-4" />
            </TapScaleButton>
          </div>
          {send.message.trim() ? (
            <TapScaleButton
              type="button"
              onClick={() => send.handleSend()}
              disabled={send.sending}
              haptic
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-indigo-400 text-white shadow-lg shadow-indigo-500/20 transition-all duration-150 animate-in zoom-in-95 hover:brightness-110 active:scale-95 disabled:opacity-50"
              title={send?.editingId ? "Сохранить изменения" : "Отправить"}
            >
              <Send className="w-4 h-4 translate-x-[-1px] translate-y-[1px]" />
            </TapScaleButton>
          ) : send.voiceState === "recording" ? (
            <TapScaleButton
              type="button"
              onClick={send.handleMicClick}
              onPointerUp={send.handleMicPointerUp}
              haptic
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center gap-1 rounded-full bg-red-500 text-white transition-all duration-150 active:scale-95 hover:bg-red-600"
              title="Остановить запись"
            >
              <Square className="w-4 h-4 fill-current" />
              <span className="text-[10px] font-medium">{send.durationSec}с</span>
            </TapScaleButton>
          ) : (
            <TapScaleButton
              type="button"
              onPointerDown={send.handleMicPointerDown}
              onPointerUp={send.handleMicPointerUp}
              onPointerLeave={send.handleMicPointerLeave}
              onPointerCancel={send.handleMicPointerLeave}
              disabled={send.sendingVoice || !send.voiceSupported}
              haptic
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-foreground transition-all duration-150 active:scale-95 hover:bg-secondary/80 disabled:opacity-50"
              title={!send.voiceSupported ? "Запись голоса недоступна в этом браузере" : "Удерживайте для записи голосового"}
            >
              {send.sendingVoice ? <span className="text-[10px]">...</span> : <Mic className="w-4 h-4" />}
            </TapScaleButton>
          )}
        </div>
        </div>
        {(send.voiceError || send.voiceRecorderError) && (
          <p className="text-[10px] text-destructive mt-0.5">{send.voiceError ?? send.voiceRecorderError}</p>
        )}
      </div>
    </div>
  );
}
