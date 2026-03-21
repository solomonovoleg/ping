import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronDown, Phone, Video, MoreVertical, Send, Paperclip, Mic, Smile, Square, Copy, Trash2, Edit3, CheckSquare, Share2, Reply, Camera, Image, X, Bookmark, BookmarkCheck, MessageCircle, Sparkles, Lock, ArrowUp, Check, Users, ImagePlus, List, FolderPlus, RotateCcw, Type, Clock, Link2, Languages, Code } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/motion";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useCallContext } from "@/contexts/CallContext";
import { useGroupCallContext } from "@/contexts/GroupCallContext";
import { isGroupCallModuleEnabled } from "@/features/group-call/flags";
import { fetchActiveGroupCall, type GroupCallMedia } from "@/lib/group-calls-api";
import { UserAvatar } from "@/components/UserAvatar";
import { getMessages, uploadVoice, uploadChatMedia, sendMessage, addMessageReaction, REACTION_EMOJIS, saveMessage, unsaveMessage, isMessageSaved, updateChat, createChatFolder, listChatFolders } from "@/lib/chat";
import { compressImage } from "@/lib/compress-image";
import { setDraft, clearDraft } from "@/lib/chat-drafts";
import { useToast } from "@/hooks/use-toast";

import { isNative, takePhotoFromCamera, pickPhotoFromGallery, triggerLightHaptic } from "@/lib/capacitor-native";
import { playSendSound, playIncomingChatMessageSound } from "@/lib/send-sound";
import { LoadingProgress } from "@/components/ui/loading-progress";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { NAME_MAX_LENGTH } from "@shared/schema";
import { DELETE_FOR_EVERYONE_MINUTES } from "@shared/constants";
import type { ApiChat, ApiMessage, MessageListItem } from "@/features/chat";
import { EMOJIS, formatLastSeen, buildMessageListItems } from "@/features/chat";
import { ChatMessageRow } from "@/features/chat/components/ChatMessageRow";
import { useChatMessages } from "@/features/chat/hooks/useChatMessages";
import { useMessageReadOnVisible } from "@/features/chat/hooks/useMessageReadOnVisible";
import { useSendMessage } from "@/features/chat/hooks/useSendMessage";
import { useMessageActions } from "@/features/chat/hooks/useMessageActions";
import { useSpellCheck } from "@/features/chat/hooks/useSpellCheck";
import { SpellSuggestions } from "@/features/chat/components/SpellSuggestions";
import type { SpellError } from "@/lib/spellcheck";
import { getSpellCheckEnabled, getChatSpellCheckEnabled, setChatSpellCheckEnabled } from "@/lib/spellcheck-prefs";
import { getTranslateEnabled, setTranslateEnabled, getTranslateLang, setTranslateLang, syncPrefsOnChatOpen, TRANSLATE_LANGUAGES, type TranslateLangCode } from "@/lib/translate-prefs";
import { useMessageTranslation } from "@/features/chat/hooks/useMessageTranslation";
import { AI_CHAT_ID } from "@/features/chat/constants";
import { useAiChat } from "@/features/chat/hooks/useAiChat";
import { formatMessageTime, parseMessageDate } from "@/features/chat/utils/format";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildProfilePath } from "@/lib/profile-route";
import { resolveUrl } from "@/lib/api-base";
import { GroupChatParticipantsSheet } from "@/features/chat/components/GroupChatParticipantsSheet";
import { ChatMediaLinksSheet } from "@/features/chat/components/ChatMediaLinksSheet";
import { MentionPicker } from "@/features/chat/components/MentionPicker";
import { MediaViewer } from "@/components/MediaViewer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AddToTrackModal } from "@/features/board/tracks";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useChatVibe } from "@/features/chat/hooks/useChatVibe";
import { ChatVibeBackground } from "@/features/chat/components/ChatVibeBackground";
import { ChatVibeOverlay } from "@/features/chat/components/ChatVibeOverlay";
import { ChatHeaderStoryRing } from "@/features/chat/components/ChatHeaderStoryRing";
import {
  ChatComposerSttButton,
  ChatComposerSttPhaseOverlay,
} from "@/features/chat/components/ChatComposerSttButton";
import { PULSE_THEME_ACCENTS } from "@/lib/chat-vibe-themes";
import { PulseDmComposerMedia } from "@/features/chat/components/pulse/PulseDmComposerMedia";

type ChatPlatformKind = "ios" | "android" | "web";
type ChatBackgroundPreset = "matte_black" | "velvet_gradient" | "obsidian_black";
type ChatMessageBubblePreset = "primary" | "slate" | "violet" | "sky";

const CHAT_BG_STORAGE_PREFIX = "ping-chat-bg:";
const CHAT_MSG_COLOR_STORAGE_PREFIX = "ping-chat-msg-color:";

const CHAT_BG_PRESETS: Array<{
  id: ChatBackgroundPreset;
  title: string;
  description: string;
  swatchClassName: string;
  darkBgClassName: string;
}> = [
  {
    id: "matte_black",
    title: "Матовый черный",
    description: "Строгий черный, слегка матовый",
    swatchClassName: "bg-[linear-gradient(180deg,#050505_0%,#0c0c0c_50%,#111_100%)]",
    darkBgClassName: "bg-[linear-gradient(180deg,#050505_0%,#0c0c0c_50%,#111_100%)]",
  },
  {
    id: "velvet_gradient",
    title: "Премиум градиент",
    description: "Тёплый градиент с фиолетовым оттенком",
    swatchClassName: "bg-[radial-gradient(140%_120%_at_30%_-10%,#2a1f3d_0%,#1a1425_35%,#0d0a12_70%,#050408_100%)]",
    darkBgClassName: "bg-[radial-gradient(140%_120%_at_30%_-10%,#2a1f3d_0%,#1a1425_35%,#0d0a12_70%,#050408_100%)]",
  },
  {
    id: "obsidian_black",
    title: "Obsidian Black",
    description: "Холодный черный с синим отблеском",
    swatchClassName: "bg-[radial-gradient(150%_110%_at_85%_-5%,#0d1820_0%,#081118_40%,#040a0f_75%,#020508_100%)]",
    darkBgClassName: "bg-[radial-gradient(150%_110%_at_85%_-5%,#0d1820_0%,#081118_40%,#040a0f_75%,#020508_100%)]",
  },
];

function isChatBackgroundPreset(value: string): value is ChatBackgroundPreset {
  return CHAT_BG_PRESETS.some((preset) => preset.id === value);
}

function getChatBackgroundStorageKey(chatId: string): string {
  return `${CHAT_BG_STORAGE_PREFIX}${chatId}`;
}

const MSG_BUBBLE_PRESETS: Array<{
  id: ChatMessageBubblePreset;
  title: string;
  swatchClassName: string;
}> = [
  { id: "primary", title: "Основной", swatchClassName: "bg-primary" },
  { id: "slate", title: "Серый", swatchClassName: "bg-slate-500" },
  { id: "violet", title: "Фиолетовый", swatchClassName: "bg-violet-500" },
  { id: "sky", title: "Голубой", swatchClassName: "bg-sky-500" },
];

function isChatMessageBubblePreset(value: string): value is ChatMessageBubblePreset {
  return MSG_BUBBLE_PRESETS.some((preset) => preset.id === value);
}

function getChatMsgColorStorageKey(chatId: string): string {
  return `${CHAT_MSG_COLOR_STORAGE_PREFIX}${chatId}`;
}

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
    <div className="absolute inset-0 z-[100] flex h-full w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-[radial-gradient(circle_at_top_right,hsl(var(--muted))_0%,hsl(var(--background))_56%,white_100%)] pb-[var(--uix-chat-bottom-pad)] uix-screen">
      <header className={cn("uix-content-x sticky top-0 z-20 mx-1 mt-1 flex items-center justify-between rounded-[20px] border border-indigo-500/20 bg-white/78 shadow-[0_12px_34px_rgba(70,71,211,0.12)] backdrop-blur-xl pt-safe-offset-2 dark:border-slate-700/45 dark:bg-slate-900/76", spacing.headerYClass)}>
        <div className="flex min-w-0 items-center gap-2">
          <TapScaleButton
            type="button"
            onClick={() => setLocation("/")}
            className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] rounded-full p-2 text-indigo-600/90 transition-colors hover:bg-slate-100/50 dark:text-indigo-300/90 dark:hover:bg-slate-800/50"
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
            <p className="truncate text-[15px] font-semibold tracking-tight text-indigo-700/95 dark:text-indigo-200">Atmospheric AI</p>
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/90" aria-hidden />
              <span className="truncate text-[11px] font-medium text-muted-foreground/90">в сети</span>
            </div>
          </div>
        </div>
        <TapScaleButton
          type="button"
          className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] rounded-full p-2 text-slate-500/85 transition-colors hover:bg-slate-100/50 dark:text-slate-400/90 dark:hover:bg-slate-800/50"
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

      <section className={cn("uix-content-x absolute inset-x-0 bottom-0 z-20 pb-4 pb-safe", spacing.bottomBarYClass)}>
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
function RecordingStrip({
  durationSec,
  onStop,
  className,
}: {
  durationSec: number;
  onStop: () => void;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const m = Math.floor(durationSec / 60);
  const s = Math.floor(durationSec % 60);
  const timeStr = `${m}:${String(s).padStart(2, "0")}`;
  const bars = 7;
  return (
    <motion.div
      className={cn(
        "chat-composer-recording-strip mb-2 overflow-hidden rounded-2xl border border-red-400/40 bg-gradient-to-r from-red-500/20 via-rose-500/15 to-red-600/25 dark:from-red-600/25 dark:via-rose-600/20 dark:to-red-700/30 shadow-[0_0_24px_-4px_rgba(239,68,68,0.35)] dark:shadow-[0_0_28px_-4px_rgba(239,68,68,0.4)]",
        className,
      )}
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

function formatVideoNoteTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
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
  const { toast } = useToast();
  const spacing = useChatSpacingPreset();
  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();
  if (chatIdParam === AI_CHAT_ID) return <AIChatView />;

  const sendDraftRef = useRef<{ setMessage: (v: string | ((p: string) => string)) => void } | null>(null);
  const {
    chatId,
    chat,
    setChat,
    folders,
    currentFolderId,
    loadMessagesForFolder,
    refreshFolders,
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

  useMessageReadOnVisible(scrollContainerRef, chatId, messages, user?.id ?? null);

  const send = useSendMessage({ chatId, folderId: currentFolderId, setMessages, user });
  sendDraftRef.current = send;

  const [spellCheckEnabled, setSpellCheckEnabledState] = useState(getSpellCheckEnabled);
  const [chatSpellCheck, setChatSpellCheckState] = useState(() => getChatSpellCheckEnabled(chatId));
  useEffect(() => {
    setChatSpellCheckState(getChatSpellCheckEnabled(chatId));
  }, [chatId]);
  useEffect(() => {
    const handler = () => setSpellCheckEnabledState(getSpellCheckEnabled());
    window.addEventListener("ping:spellcheck-change", handler);
    return () => window.removeEventListener("ping:spellcheck-change", handler);
  }, []);

  const effectiveSpellCheck = spellCheckEnabled && chatSpellCheck;
  const spellErrors = useSpellCheck(send.message, effectiveSpellCheck);
  const [spellUndo, setSpellUndo] = useState<{ from: string; to: string } | null>(null);

  const [chatTranslateEnabled, setChatTranslateEnabledState] = useState(() => getTranslateEnabled(chatId));
  const [translateLang, setTranslateLangState] = useState<TranslateLangCode>(getTranslateLang);
  useEffect(() => {
    setChatTranslateEnabledState(getTranslateEnabled(chatId));
    syncPrefsOnChatOpen(chatId);
  }, [chatId]);
  useEffect(() => {
    const handler = () => {
      setChatTranslateEnabledState(getTranslateEnabled(chatId));
      setTranslateLangState(getTranslateLang());
    };
    window.addEventListener("ping:translate-change", handler);
    return () => window.removeEventListener("ping:translate-change", handler);
  }, [chatId]);

  const { translations, showOriginalIds, toggleOriginal } = useMessageTranslation(
    messages,
    chatTranslateEnabled,
    translateLang,
    user?.id ?? "",
    chatId,
  );

  const lastAppliedTextRef = useRef<string | null>(null);
  const lastProcessedErrorsRef = useRef<string>("");
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (!effectiveSpellCheck || spellErrors.length === 0) return;
    const text = sendRef.current.message;
    if (spellUndo?.from === text) {
      setSpellUndo(null);
      return;
    }
    if (lastAppliedTextRef.current === text) return;
    const errorsKey = spellErrors.map((e) => `${e.pos}:${e.word}:${e.s?.[0] ?? ""}`).join("|");
    if (lastProcessedErrorsRef.current === errorsKey) return;

    const applicable = spellErrors.filter((e) => e.s?.[0] && e.s[0] !== e.word);
    if (applicable.length === 0) return;

    const sorted = [...applicable].sort((a, b) => b.pos - a.pos);
    let corrected = text;
    for (const err of sorted) {
      const atPos = corrected.slice(err.pos, err.pos + err.len);
      if (atPos !== err.word) continue;
      const rep = err.s![0];
      corrected = corrected.slice(0, err.pos) + rep + corrected.slice(err.pos + err.len);
    }
    if (corrected !== text) {
      lastProcessedErrorsRef.current = errorsKey;
      lastAppliedTextRef.current = corrected;
      setSpellUndo({ from: text, to: corrected });
      sendRef.current.setMessage(corrected);
    }
  }, [spellErrors, effectiveSpellCheck, spellUndo?.from]);

  const handleSpellReplace = useCallback(
    (err: SpellError, replacement: string) => {
      const t = send.message;
      const atPos = t.slice(err.pos, err.pos + err.len);
      if (atPos === err.word) {
        send.setMessage(t.slice(0, err.pos) + replacement + t.slice(err.pos + err.len));
      } else {
        const idx = t.indexOf(err.word);
        if (idx >= 0) send.setMessage(t.slice(0, idx) + replacement + t.slice(idx + err.word.length));
      }
    },
    [send]
  );

  const handleSpellUndo = useCallback(() => {
    if (spellUndo) {
      lastAppliedTextRef.current = spellUndo.from;
      send.setMessage(spellUndo.from);
      setSpellUndo(null);
      triggerLightHaptic();
    }
  }, [spellUndo, send]);

  useEffect(() => {
    if (!send.message.trim()) {
      if (spellUndo) setSpellUndo(null);
      lastProcessedErrorsRef.current = "";
      lastAppliedTextRef.current = null;
    }
  }, [send.message, spellUndo]);

  useEffect(() => {
    if (pendingCursorRef.current !== null && messageInputRef.current) {
      const pos = pendingCursorRef.current;
      pendingCursorRef.current = null;
      requestAnimationFrame(() => {
        messageInputRef.current?.focus({ preventScroll: true });
        messageInputRef.current?.setSelectionRange(pos, pos);
      });
    }
  }, [send.message]);

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

  // Скролл к сообщению из поиска (?messageId=...)
  const scrollToMessageIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading || !chatId) return;
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const messageId = params?.get("messageId") ?? null;
    if (!messageId || scrollToMessageIdRef.current === messageId) return;
    const hasMessage = messages.some((m) => m.id === messageId);
    if (hasMessage) {
      scrollToMessageIdRef.current = messageId;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => actions.scrollToMessageAndHighlight(messageId));
      });
      setLocation(`/chat/${chatId}`, { replace: true } as { replace?: boolean });
    }
  }, [loading, chatId, messages, actions.scrollToMessageAndHighlight, setLocation]);
  useEffect(() => () => { scrollToMessageIdRef.current = null; }, [chatId]);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const pendingCursorRef = useRef<number | null>(null);
  const [showAttachSource, setShowAttachSource] = useState(false);
  const [draftRestoredHint, setDraftRestoredHint] = useState(false);
  const [composerSttUi, setComposerSttUi] = useState<{ phase: "idle" | "listening" | "transcribing"; liveLine: string }>({
    phase: "idle",
    liveLine: "",
  });
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unseenIncomingCount, setUnseenIncomingCount] = useState(0);
  const [chatBgPreset, setChatBgPreset] = useState<ChatBackgroundPreset>("matte_black");
  const [chatMsgColorPreset, setChatMsgColorPreset] = useState<ChatMessageBubblePreset>("primary");
  const [showChatThemeMenu, setShowChatThemeMenu] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showMediaLinksSheet, setShowMediaLinksSheet] = useState(false);
  const [showGroupParticipants, setShowGroupParticipants] = useState(false);
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);
  const [mediaViewer, setMediaViewer] = useState<{ src: string; type: "image" | "video" | "video_note" } | null>(null);
  useEffect(() => {
    setActiveVoiceId(null);
  }, [chatId]);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const mentionPickerRef = useRef<HTMLDivElement>(null);
  const [uploadingGroupAvatar, setUploadingGroupAvatar] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    if (typeof document === "undefined") return false;
    const root = document.documentElement;
    return root.classList.contains("dark") || root.classList.contains("theme-fitfin");
  });
  const vibe = useChatVibe(chat?.type === "dm" ? chatId : undefined, {
    surface: isDarkTheme ? "dark" : "light",
  });
  const attachSourceRef = useRef<HTMLDivElement>(null);
  const chatThemeMenuRef = useRef<HTMLDivElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const composerBarRef = useRef<HTMLDivElement>(null);
  const [composerBarHeightPx, setComposerBarHeightPx] = useState(0);
  const lastMessageIdRef = useRef<string>("");
  const { startCall } = useCallContext();
  const groupCallCtx = useGroupCallContext();
  const [groupCallLobby, setGroupCallLobby] = useState<{
    roomId: string;
    mediaType: GroupCallMedia;
    participantCount: number;
    hostUserId: string;
  } | null>(null);
  const lastGroupCallNotifyRoomRef = useRef<string | null>(null);

  const startCallUnlessInGroup = useCallback(
    (
      otherUserId: string,
      otherDisplayName: string | null,
      cid: string,
      video: boolean,
      avatarUrl?: string | null,
    ) => {
      if (groupCallCtx.active) {
        toast({ title: "Сначала завершите групповой созвон", variant: "destructive" });
        return;
      }
      const messageContext =
        chat?.type === "group"
          ? { kind: "group" as const, folderId: currentFolderId }
          : { kind: "dm" as const };
      startCall(otherUserId, otherDisplayName, cid, video, avatarUrl, messageContext);
    },
    [groupCallCtx.active, startCall, toast, chat?.type, currentFolderId],
  );

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
    if (loading) return;
    const bar = composerBarRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height ?? 0;
      setComposerBarHeightPx(h > 0 ? Math.ceil(h) : 0);
    });
    ro.observe(bar);
    return () => ro.disconnect();
  }, [loading, chatId]);

  useEffect(() => {
    const id = requestAnimationFrame(() => syncComposerHeight());
    return () => cancelAnimationFrame(id);
  }, [send.message, syncComposerHeight]);

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
    if (!isGroupCallModuleEnabled() || !chatId || chat?.type !== "group" || groupCallCtx.active) {
      setGroupCallLobby(null);
      return;
    }
    let alive = true;
    const tick = () => {
      void fetchActiveGroupCall(chatId).then((r) => {
        if (!alive) return;
        if (r.active) {
          setGroupCallLobby({
            roomId: r.roomId,
            mediaType: r.mediaType,
            participantCount: r.participantCount,
            hostUserId: typeof r.hostUserId === "string" ? r.hostUserId : "",
          });
        } else {
          setGroupCallLobby(null);
        }
      });
    };
    tick();
    const id = window.setInterval(tick, 4_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [chatId, chat?.type, groupCallCtx.active]);

  useEffect(() => {
    if (!groupCallLobby) {
      lastGroupCallNotifyRoomRef.current = null;
      return;
    }
    if (lastGroupCallNotifyRoomRef.current === groupCallLobby.roomId) return;
    lastGroupCallNotifyRoomRef.current = groupCallLobby.roomId;
    playIncomingChatMessageSound();
  }, [groupCallLobby]);

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
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const update = () => setIsDarkTheme(root.classList.contains("dark") || root.classList.contains("theme-fitfin"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!chatId) return;
    try {
      const saved = localStorage.getItem(getChatBackgroundStorageKey(chatId));
      if (saved && isChatBackgroundPreset(saved)) {
        setChatBgPreset(saved);
      } else {
        setChatBgPreset("matte_black");
      }
    } catch {
      setChatBgPreset("matte_black");
    }
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    try {
      const saved = localStorage.getItem(getChatMsgColorStorageKey(chatId));
      if (saved && isChatMessageBubblePreset(saved)) {
        setChatMsgColorPreset(saved);
      } else {
        setChatMsgColorPreset("primary");
      }
    } catch {
      setChatMsgColorPreset("primary");
    }
  }, [chatId]);

  useEffect(() => {
    if (!showChatThemeMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (chatThemeMenuRef.current?.contains(e.target as Node)) return;
      setShowChatThemeMenu(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showChatThemeMenu]);

  useEffect(() => {
    if (!showGroupMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (groupMenuRef.current?.contains(e.target as Node)) return;
      setShowGroupMenu(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showGroupMenu]);

  const handleGroupAvatarSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !chatId || !chat || chat.type !== "group") return;
      setUploadingGroupAvatar(true);
      try {
        const url = await uploadChatMedia(file);
        await updateChat(chatId, { avatarUrl: url });
        setChat((prev) => (prev ? { ...prev, avatarUrl: url } : prev));
        toast({ title: "Аватар группы обновлён" });
      } catch (err) {
        toast({ title: err instanceof Error ? err.message : "Ошибка загрузки", variant: "destructive" });
      } finally {
        setUploadingGroupAvatar(false);
      }
    },
    [chatId, chat, setChat, toast]
  );

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
  const HEADER_NAME_MAX_LENGTH = 16;
  /** Имя для однострочного отображения в шапке: до 16 символов, затем многоточие */
  const displayNameShort =
    displayName && displayName !== "Диалог"
      ? (displayName.length > HEADER_NAME_MAX_LENGTH ? displayName.slice(0, HEADER_NAME_MAX_LENGTH) + "…" : displayName)
      : null;
  const callerDisplayName = user ? [user.displayName, user.surname].filter(Boolean).join(" ") || user.phone || "Абонент" : "Абонент";
  const trimmedComposerText = send.message.trim();
  const isCanvasPrefix = trimmedComposerText.startsWith("!");
  const showCanvasCommandOption = trimmedComposerText === "!";
  const isCanvasMode = isCanvasPrefix && trimmedComposerText.length > 1;

  const isDm = chat?.type === "dm";
  const senderNamesMap = useMemo(() => {
    const map = new Map<string, string>();
    if (user?.id) map.set(user.id, "Вы");
    if (chat?.members) {
      for (const m of chat.members) {
        if (!map.has(m.id)) {
          const name = [m.displayName, m.surname].filter(Boolean).join(" ") || `ID ${m.id.slice(0, 8)}`;
          map.set(m.id, name);
        }
      }
    }
    return map;
  }, [chat?.members, user?.id]);
  const messageListItems = useMemo(() => buildMessageListItems(messages), [messages]);
  const nextVoiceByMessageId = useMemo(() => {
    const map = new Map<string, string>();
    const items = messageListItems.filter(
      (i): i is Extract<MessageListItem, { type: "message" }> => i.type === "message"
    );
    for (let i = 0; i < items.length; i++) {
      if (items[i].msg.type !== "voice") continue;
      const next = items.slice(i + 1).find((it) => it.msg.type === "voice");
      if (next) map.set(items[i].msg.id, next.msg.id);
    }
    return map;
  }, [messageListItems]);
  const selectedChatBgPreset = CHAT_BG_PRESETS.find((preset) => preset.id === chatBgPreset) ?? CHAT_BG_PRESETS[0];
  const isDmChat = chat?.type === "dm";
  const chatSurfaceClassName =
    isDmChat && isDarkTheme
      ? "bg-[#080810]"
      : isDmChat && !isDarkTheme
        ? "bg-[#eef1fb]"
        : isDarkTheme
          ? selectedChatBgPreset.darkBgClassName
          : "bg-[radial-gradient(circle_at_top_right,hsl(var(--muted))_0%,hsl(var(--background))_56%,white_100%)]";
  const dmStatusLine = chat?.type === "dm" ? formatLastSeen(chat.otherMember?.lastSeenAt ?? null) : null;
  /** Личный чат на мобиле: хедер и композер как в pulse-template (MobileChatDark / DESIGN_RULES) */
  const pulseDmMobileChrome = isDmChat && isMobile && isDarkTheme;
  const pulseDmLightMobileChrome = isDmChat && isMobile && !isDarkTheme;
  const dmPulseAccent = vibe.isActive ? PULSE_THEME_ACCENTS[vibe.theme] : "#818cf8";
  const headerPulseMobileDm = pulseDmMobileChrome || pulseDmLightMobileChrome;
  /** DOM как в pulse-template: скрепка | капсула (поле + !) | круг видео | микрофон */
  const pulseDmComposerLikeTemplate = headerPulseMobileDm && isDmChat;
  const messageListPaddingBottom = useMemo(() => {
    if (composerBarHeightPx > 0) {
      return `calc(${composerBarHeightPx + 8}px + env(safe-area-inset-bottom, 0px))`;
    }
    return spacing.chatListBottomPad;
  }, [composerBarHeightPx, spacing.chatListBottomPad]);

  const pulseDmMediaActive =
    pulseDmComposerLikeTemplate &&
    (send.voiceState === "recording" ||
      Boolean(send.voicePreviewUrl) ||
      send.videoNoteState === "recording" ||
      send.videoNoteState === "preview");

  if (loading) {
    return (
      <div className={cn("absolute inset-0 z-[100] flex h-full w-full min-w-0 max-w-full flex-col overflow-x-hidden pb-[var(--uix-chat-bottom-pad)] uix-screen", chatSurfaceClassName)}>
        <div className={cn("uix-content-x sticky top-0 z-20 mx-1 mt-1 flex items-center gap-2 rounded-[20px] border border-indigo-500/20 bg-white/78 shadow-[0_12px_34px_rgba(70,71,211,0.12)] backdrop-blur-xl pt-safe-offset-2 dark:border-slate-700/45 dark:bg-slate-900/76", spacing.headerYClass)}>
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
      <div className={cn("absolute inset-0 z-[100] flex h-full flex-col items-center justify-center gap-4 p-4 text-muted-foreground uix-screen", chatSurfaceClassName)}>
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
    <div
      className={cn(
        "absolute inset-0 z-[100] flex h-full w-full min-w-0 max-w-full flex-col overflow-x-hidden pb-[var(--uix-chat-bottom-pad)] uix-screen",
        chatSurfaceClassName,
        pulseDmMobileChrome && "chat-pulse-dm-mobile",
        pulseDmLightMobileChrome && "chat-pulse-dm-light-mobile",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "sticky top-0 z-20 flex items-center gap-1 backdrop-blur-xl",
          headerPulseMobileDm
            ? "uix-content-x relative mx-0 mt-0 w-full gap-2 border-0 px-3 py-2 shadow-none rounded-none pt-safe-offset-2"
            : "uix-content-x mx-1 mt-1 rounded-[20px] border pt-safe-offset-2 px-2 sm:px-3",
          !headerPulseMobileDm &&
            (chat.type === "dm" && isDarkTheme
              ? "border-white/[0.08] bg-[#12121c]/92 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
              : "border-indigo-500/20 bg-white/78 shadow-[0_12px_34px_rgba(70,71,211,0.12)] dark:border-slate-700/45 dark:bg-slate-900/76"),
          spacing.headerYClass,
        )}
      >
        {pulseDmMobileChrome ? (
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-[rgba(8,8,16,0.94)] backdrop-blur-[20px] border-b border-white/[0.07]"
            aria-hidden
          />
        ) : null}
        {pulseDmLightMobileChrome ? (
          <div
            className="pointer-events-none absolute inset-0 z-0 border-b border-indigo-500/10 bg-white/90 backdrop-blur-xl"
            aria-hidden
          />
        ) : null}
        <button
          type="button"
          onClick={() => setLocation("/")}
          className={cn(
            "-ml-1 flex min-h-[40px] min-w-[40px] flex-shrink-0 items-center justify-center rounded-full p-2 transition-colors sm:min-w-0",
            headerPulseMobileDm && "relative z-[1]",
            pulseDmMobileChrome && "hover:bg-white/[0.07]",
            pulseDmLightMobileChrome && "text-indigo-600 hover:bg-indigo-500/10",
            !headerPulseMobileDm && "text-primary/90 hover:bg-primary/10",
          )}
          style={pulseDmMobileChrome ? { color: dmPulseAccent } : undefined}
          aria-label="Назад к чатам"
        >
          <ChevronLeft className="h-6 w-6" />
          <span className="hidden text-[17px] sm:inline">Назад</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (chat.type === "dm" && chat.otherMember) {
              setLocation(
                buildProfilePath({
                  publicId: chat.otherMember.publicId ?? 0,
                  userId: chat.otherMember.id,
                  fallbackPath: "/",
                })
              );
            } else if (chat.type === "group") {
              setShowGroupParticipants(true);
            }
          }}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-lg px-1 py-1 text-left -mx-1 transition-colors",
            headerPulseMobileDm && "relative z-[1]",
            pulseDmMobileChrome && "hover:bg-white/[0.06] active:bg-white/[0.09]",
            pulseDmLightMobileChrome && "hover:bg-indigo-500/[0.07] active:bg-indigo-500/10",
            !headerPulseMobileDm && "hover:bg-primary/5 active:bg-primary/10",
          )}
          title={chat.type === "dm" && chat.otherMember ? "Открыть профиль" : chat.type === "group" ? "Участники группы" : undefined}
          aria-label={chat.type === "dm" && chat.otherMember ? `Профиль: ${displayName}` : chat.type === "group" ? "Участники группы" : undefined}
        >
          {chat.type === "group" ? (
            chat.avatarUrl ? (
              <img
                src={resolveUrl(chat.avatarUrl)}
                alt=""
                className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex -space-x-2.5 w-10 h-10 flex-shrink-0 items-center justify-start mr-9">
                {(chat.members ?? []).slice(0, 4).map((m) => (
                  <UserAvatar
                    key={m.id}
                    avatarUrl={m.avatarUrl ?? undefined}
                    displayName={[m.displayName, m.surname].filter(Boolean).join(" ") || `ID ${m.publicId}`}
                    seed={m.id}
                    size={28}
                    className="h-7 w-7 rounded-full border-2 border-background flex-shrink-0 ring-1 ring-background"
                  />
                ))}
              </div>
            )
          ) : (
            <ChatHeaderStoryRing
              accentColor={isDmChat && vibe.isActive ? PULSE_THEME_ACCENTS[vibe.theme] : "#6366f1"}
              className="h-10 w-10"
              ringGapClassName={pulseDmMobileChrome ? "!bg-[#080810]" : undefined}
            >
              <UserAvatar
                avatarUrl={chat.otherMember?.avatarUrl}
                displayName={displayName}
                seed={chat.otherMember?.id ?? chat.id}
                size={40}
                className="h-10 w-10 rounded-full flex-shrink-0"
              />
            </ChatHeaderStoryRing>
          )}
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-semibold leading-tight",
                pulseDmMobileChrome && "text-white",
                pulseDmLightMobileChrome && "text-slate-900",
              )}
            >
              {displayNameShort ?? displayName}
            </p>
            {chat.type === "dm" ? (
              <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5">
                {dmStatusLine === "в сети" ? (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.65)]"
                    aria-hidden
                  />
                ) : null}
                <span
                  className={cn(
                    "truncate text-[11px] leading-tight",
                    pulseDmMobileChrome && "text-white/50",
                    pulseDmLightMobileChrome && "text-slate-500",
                    !headerPulseMobileDm && "text-muted-foreground/90",
                  )}
                >
                  {dmStatusLine ?? "не в сети"}
                </span>
              </div>
            ) : (
              <p className="text-muted-foreground/90 text-[11px] leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                {`${chat.members?.length ?? 0} участников`}
              </p>
            )}
          </div>
        </button>
        <div className={cn("flex flex-shrink-0 items-center gap-0.5", headerPulseMobileDm && "relative z-[1]")}>
          {chat.type === "dm" && chat.otherMember && (
            <>
              <button
                type="button"
                className={cn(
                  "flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full p-2 transition-colors",
                  pulseDmMobileChrome && "text-white/45 hover:bg-white/[0.07]",
                  pulseDmLightMobileChrome && "text-slate-500 hover:bg-indigo-500/10",
                  !headerPulseMobileDm && "text-primary/85 hover:bg-primary/10",
                )}
                onClick={() =>
                  startCallUnlessInGroup(chat.otherMember!.id, displayName, chatId, false, chat.otherMember?.avatarUrl)
                }
                aria-label="Аудиозвонок"
              >
                <Phone className="w-5 h-5" />
              </button>
              <button
                type="button"
                className={cn(
                  "flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full p-2 transition-colors",
                  pulseDmMobileChrome && "text-white/45 hover:bg-white/[0.07]",
                  pulseDmLightMobileChrome && "text-slate-500 hover:bg-indigo-500/10",
                  !headerPulseMobileDm && "text-primary/85 hover:bg-primary/10",
                )}
                onClick={() =>
                  startCallUnlessInGroup(chat.otherMember!.id, displayName, chatId, true, chat.otherMember?.avatarUrl)
                }
                aria-label="Видеозвонок"
              >
                <Video className="w-5 h-5" />
              </button>
            </>
          )}
          {chat.type === "group" && isGroupCallModuleEnabled() && chatId ? (
            <>
              <button
                type="button"
                className="p-2 rounded-full text-primary/85 hover:bg-primary/10 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                onClick={() => {
                  if (groupCallCtx.active) {
                    toast({ title: "Созвон уже открыт", description: "Завершите текущий групповой звонок или вернитесь к его окну.", variant: "destructive" });
                    return;
                  }
                  void groupCallCtx.startGroupCall(chatId, displayName, false);
                }}
                aria-label="Групповой аудиозвонок"
              >
                <Phone className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="p-2 rounded-full text-primary/85 hover:bg-primary/10 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                onClick={() => {
                  if (groupCallCtx.active) {
                    toast({ title: "Созвон уже открыт", description: "Завершите текущий групповой звонок или вернитесь к его окну.", variant: "destructive" });
                    return;
                  }
                  void groupCallCtx.startGroupCall(chatId, displayName, true);
                }}
                aria-label="Групповое видео"
              >
                <Video className="w-5 h-5" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            className={cn(
              "flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full p-2 transition-colors",
              pulseDmMobileChrome && "text-white/45 hover:bg-white/[0.07]",
              pulseDmLightMobileChrome && "text-slate-500 hover:bg-indigo-500/10",
              !headerPulseMobileDm && "text-primary/75 hover:bg-primary/10",
            )}
            onClick={() => (chat.type === "group" ? setShowGroupMenu((p) => !p) : setShowChatThemeMenu((p) => !p))}
            aria-label="Ещё"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
        {showGroupMenu && chat.type === "group" && (
          <div
            ref={groupMenuRef}
            className="absolute right-2 top-[calc(100%+8px)] z-[125] flex w-[280px] max-h-[min(70vh,420px)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="shrink-0 border-b border-border/60 px-4 py-3">
              <p className="text-sm font-semibold">Настройки группы</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{displayName}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
              <button
                type="button"
                onClick={() => {
                  setShowGroupMenu(false);
                  setShowMediaLinksSheet(true);
                }}
                className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/70"
              >
                <Image className="h-5 w-5 shrink-0 text-primary" />
                <span className="flex-1 text-sm font-medium">Медиафайлы и ссылки</span>
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGroupMenu(false);
                  setShowGroupParticipants(true);
                }}
                className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/70 last:mb-0"
              >
                <Users className="h-5 w-5 shrink-0 text-primary" />
                <span className="flex-1 text-sm font-medium">Участники ({chat.members?.length ?? 0})</span>
              </button>
              {isGroupCallModuleEnabled() && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGroupMenu(false);
                      void groupCallCtx.startGroupCall(chatId, displayName, false);
                    }}
                    className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/70"
                  >
                    <Phone className="h-5 w-5 shrink-0 text-primary" />
                    <span className="flex-1 text-sm font-medium">Групповой звонок</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGroupMenu(false);
                      void groupCallCtx.startGroupCall(chatId, displayName, true);
                    }}
                    className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/70"
                  >
                    <Video className="h-5 w-5 shrink-0 text-primary" />
                    <span className="flex-1 text-sm font-medium">Групповое видео</span>
                  </button>
                </>
              )}
              {chat.myRole === "admin" && (
                <button
                  type="button"
                  onClick={async () => {
                    setShowGroupMenu(false);
                    const name = window.prompt("Название папки");
                    if (!name?.trim()) return;
                    try {
                      await createChatFolder(chatId, name.trim());
                      await refreshFolders();
                      toast({ title: "Папка создана" });
                    } catch (err) {
                      toast({ title: err instanceof Error ? err.message : "Не удалось создать папку", variant: "destructive" });
                    }
                  }}
                  className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/70 last:mb-0"
                >
                  <FolderPlus className="h-5 w-5 shrink-0 text-primary" />
                  <span className="flex-1 text-sm font-medium">Создать папку</span>
                </button>
              )}
              <button
                type="button"
                disabled={uploadingGroupAvatar}
                onClick={() => {
                  setShowGroupMenu(false);
                  groupAvatarInputRef.current?.click();
                }}
                className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/70 last:mb-0 disabled:opacity-60"
              >
                <ImagePlus className="h-5 w-5 shrink-0 text-primary" />
                <span className="flex-1 text-sm font-medium">
                  {uploadingGroupAvatar ? "Загрузка…" : "Загрузить аватар группы"}
                </span>
              </button>
              <div className="border-t border-border/60 mt-2 pt-2">
                <p className="px-2 py-1 text-[11px] text-muted-foreground">Фон чата</p>
                {CHAT_BG_PRESETS.map((preset) => {
                  const active = preset.id === chatBgPreset;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setChatBgPreset(preset.id);
                        if (chatId) {
                          try {
                            localStorage.setItem(getChatBackgroundStorageKey(chatId), preset.id);
                          } catch {}
                        }
                      }}
                      className={cn(
                        "mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors last:mb-0",
                        active ? "bg-primary/12" : "hover:bg-secondary/70"
                      )}
                    >
                      <span className={cn("h-8 w-12 shrink-0 rounded-lg border border-white/10", preset.swatchClassName)} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{preset.title}</span>
                      {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-border/60 mt-2 pt-2">
                <p className="px-2 py-1 text-[11px] text-muted-foreground">Цвет моих сообщений</p>
                {MSG_BUBBLE_PRESETS.map((preset) => {
                  const active = preset.id === chatMsgColorPreset;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setChatMsgColorPreset(preset.id);
                        if (chatId) {
                          try {
                            localStorage.setItem(getChatMsgColorStorageKey(chatId), preset.id);
                          } catch {}
                        }
                      }}
                      className={cn(
                        "mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors last:mb-0",
                        active ? "bg-primary/12" : "hover:bg-secondary/70"
                      )}
                    >
                      <span className={cn("h-6 w-6 shrink-0 rounded-full border border-white/20", preset.swatchClassName)} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{preset.title}</span>
                      {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-border/60 mt-2 pt-2">
                <div className="flex items-center justify-between gap-3 px-2 py-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Type className="h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Проверка орфографии</p>
                      <p className="text-[11px] text-muted-foreground">Автоисправление в этом чате</p>
                    </div>
                  </div>
                  <Switch
                    checked={chatSpellCheck}
                    onCheckedChange={(checked) => {
                      setChatSpellCheckEnabled(chatId, checked);
                      setChatSpellCheckState(checked);
                    }}
                    aria-label="Проверка орфографии в этом чате"
                  />
                </div>
              </div>
              <div className="border-t border-border/60 mt-2 pt-2">
                <div className="flex items-center justify-between gap-3 px-2 py-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Languages className="h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Переводить входящие</p>
                      <p className="text-[11px] text-muted-foreground">На ваш язык автоматически</p>
                    </div>
                  </div>
                  <Switch
                    checked={chatTranslateEnabled}
                    onCheckedChange={(checked) => {
                      setTranslateEnabled(chatId, checked);
                      setChatTranslateEnabledState(checked);
                    }}
                    aria-label="Переводить входящие сообщения"
                  />
                </div>
                {chatTranslateEnabled && (
                  <div className="px-2 pb-1">
                    <select
                      value={translateLang}
                      onChange={(e) => {
                        const lang = e.target.value as TranslateLangCode;
                        setTranslateLang(lang);
                        setTranslateLangState(lang);
                        setTranslateEnabled(chatId, true);
                      }}
                      className="w-full rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                      aria-label="Язык перевода"
                    >
                      {TRANSLATE_LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {showChatThemeMenu && chat.type !== "group" && (
          <div
            ref={chatThemeMenuRef}
            className="absolute right-2 top-[calc(100%+8px)] z-[125] flex w-[280px] max-h-[min(70vh,420px)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="shrink-0 border-b border-border/60 px-4 py-3">
              <p className="text-sm font-semibold">Настройки чата</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Фон и цвет сообщений</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
              <button
                type="button"
                onClick={() => {
                  setShowChatThemeMenu(false);
                  setShowMediaLinksSheet(true);
                }}
                className="mb-2 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/70"
              >
                <Image className="h-5 w-5 shrink-0 text-primary" />
                <span className="flex-1 text-sm font-medium">Медиафайлы и ссылки</span>
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
              <p className="px-2 py-1 text-[11px] text-muted-foreground">Фон чата</p>
              {CHAT_BG_PRESETS.map((preset) => {
                const active = preset.id === chatBgPreset;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setChatBgPreset(preset.id);
                      if (chatId) {
                        try {
                          localStorage.setItem(getChatBackgroundStorageKey(chatId), preset.id);
                        } catch {}
                      }
                    }}
                    className={cn(
                      "mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors last:mb-0",
                      active ? "bg-primary/12" : "hover:bg-secondary/70"
                    )}
                  >
                    <span className={cn("h-10 w-14 shrink-0 rounded-lg border border-white/10", preset.swatchClassName)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{preset.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{preset.description}</span>
                    </span>
                    {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
              <div className="border-t border-border/60 mt-2 pt-2">
                <p className="px-2 py-1 text-[11px] text-muted-foreground">Цвет моих сообщений</p>
                {MSG_BUBBLE_PRESETS.map((preset) => {
                  const active = preset.id === chatMsgColorPreset;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setChatMsgColorPreset(preset.id);
                        if (chatId) {
                          try {
                            localStorage.setItem(getChatMsgColorStorageKey(chatId), preset.id);
                          } catch {}
                        }
                      }}
                      className={cn(
                        "mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors last:mb-0",
                        active ? "bg-primary/12" : "hover:bg-secondary/70"
                      )}
                    >
                      <span className={cn("h-6 w-6 shrink-0 rounded-full border border-white/20", preset.swatchClassName)} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{preset.title}</span>
                      {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-border/60 mt-2 pt-2">
                <div className="flex items-center justify-between gap-3 px-2 py-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Type className="h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Проверка орфографии</p>
                      <p className="text-[11px] text-muted-foreground">Автоисправление в этом чате</p>
                    </div>
                  </div>
                  <Switch
                    checked={chatSpellCheck}
                    onCheckedChange={(checked) => {
                      setChatSpellCheckEnabled(chatId, checked);
                      setChatSpellCheckState(checked);
                    }}
                    aria-label="Проверка орфографии в этом чате"
                  />
                </div>
              </div>
              <div className="border-t border-border/60 mt-2 pt-2">
                <div className="flex items-center justify-between gap-3 px-2 py-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Languages className="h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Переводить входящие</p>
                      <p className="text-[11px] text-muted-foreground">На ваш язык автоматически</p>
                    </div>
                  </div>
                  <Switch
                    checked={chatTranslateEnabled}
                    onCheckedChange={(checked) => {
                      setTranslateEnabled(chatId, checked);
                      setChatTranslateEnabledState(checked);
                    }}
                    aria-label="Переводить входящие сообщения"
                  />
                </div>
                {chatTranslateEnabled && (
                  <div className="px-2 pb-1">
                    <select
                      value={translateLang}
                      onChange={(e) => {
                        const lang = e.target.value as TranslateLangCode;
                        setTranslateLang(lang);
                        setTranslateLangState(lang);
                        setTranslateEnabled(chatId, true);
                      }}
                      className="w-full rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                      aria-label="Язык перевода"
                    >
                      {TRANSLATE_LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Папки группового чата */}
      {chat.type === "group" && folders.length > 0 && (
        <div className="shrink-0 uix-content-x overflow-x-auto border-b border-border/60 bg-background/50">
          <div className="flex gap-1 py-2 min-w-0">
            {folders.map((f) => {
              const active = f.id === currentFolderId;
              const unread = Math.max(0, f.unreadCount ?? 0);
              const badgeLabel = unread <= 0 ? "" : unread > 99 ? "99+" : String(unread);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => loadMessagesForFolder(f.id)}
                  className={cn(
                    "shrink-0 relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors min-h-[var(--uix-touch-min)] inline-flex items-center gap-1.5",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                  aria-label={f.isMain ? `Основной чат: ${f.name}` : unread > 0 ? `${f.name}, ${unread} непрочитанных` : f.name}
                  aria-pressed={active}
                >
                  {f.name}
                  {badgeLabel && (
                    <span className="inline-flex min-h-[14px] min-w-[14px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground">
                      {badgeLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isGroupCallModuleEnabled() && chat.type === "group" && groupCallLobby && !groupCallCtx.active && (
        <div className="shrink-0 uix-content-x py-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/25 bg-primary/8 px-3 py-2.5">
            <p className="text-sm font-medium text-foreground min-w-0 flex-1">
              {groupCallLobby.participantCount === 0
                ? `Открыт групповой ${groupCallLobby.mediaType === "video" ? "видео" : "аудио"}звонок — можно подключаться`
                : `Идёт групповой ${groupCallLobby.mediaType === "video" ? "видео" : "аудио"}звонок · ${groupCallLobby.participantCount} ${
                    groupCallLobby.participantCount === 1
                      ? "участник"
                      : groupCallLobby.participantCount < 5
                        ? "участника"
                        : "участников"
                  }`}
            </p>
            <TapScaleButton
              type="button"
              className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground min-h-[var(--uix-touch-min)]"
              onClick={() => {
                groupCallCtx.joinGroupCall({
                  roomId: groupCallLobby.roomId,
                  chatId,
                  mediaType: groupCallLobby.mediaType,
                  chatTitle: displayName,
                  hostUserId: groupCallLobby.hostUserId,
                });
              }}
            >
              Подключиться
            </TapScaleButton>
          </div>
        </div>
      )}

      <input
        ref={groupAvatarInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleGroupAvatarSelect}
      />

      {showGroupParticipants && chat.type === "group" && (
        <GroupChatParticipantsSheet
          chatId={chatId}
          members={chat.members ?? []}
          currentUserId={user?.id ?? ""}
          isAdmin={chat.myRole === "admin"}
          onClose={() => setShowGroupParticipants(false)}
          onMembersChange={(updated) => setChat(updated)}
        />
      )}

      {chat && (
        <ChatMediaLinksSheet
          open={showMediaLinksSheet}
          onOpenChange={setShowMediaLinksSheet}
          chatId={chatId}
          chatName={chat.name ?? (chat.type === "dm" ? chat.otherMember?.displayName ?? "Диалог" : "Чат")}
          folderId={
            chat.type === "group" && currentFolderId
              ? (folders.find((f) => f.id === currentFolderId)?.isMain ? null : currentFolderId)
              : null
          }
          onOpenMedia={(src, type) => setMediaViewer({ src, type })}
        />
      )}

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
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {vibe.isActive && (
          <ChatVibeBackground
            theme={vibe.theme}
            tokens={vibe.tokens}
            isActive={vibe.isActive}
            isDarkSurface={isDarkTheme}
          />
        )}
        {vibe.isActive && (
          <ChatVibeOverlay theme={vibe.theme} tokens={vibe.tokens} isActive={vibe.isActive} />
        )}
      <div
        ref={scrollContainerRef}
        className={cn("uix-content-x-tight relative z-[1] flex flex-1 min-h-0 flex-col gap-0 overflow-y-auto overflow-x-hidden overscroll-y-auto touch-pan-y", spacing.messageTopPaddingClass)}
        style={{
          overflowAnchor: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: messageListPaddingBottom,
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
        {(() => {
          const pulseDmMobileKind = isDm && isMobile ? (isDarkTheme ? ("dark" as const) : ("light" as const)) : null;
          return messageListItems.map((item, idx) => {
          if (item.type === "date") {
            return (
              <p key={`date-${item.label}-${idx}`} className="sticky top-2 z-[1] mx-auto rounded-full bg-muted/70 px-3 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-sm">
                {item.label}
              </p>
            );
          }
          const { msg, isFirstInGroup, isLastInGroup } = item;
          const isMe = msg.senderId === user?.id;
          const senderName = msg.senderId
            ? (senderNamesMap.get(msg.senderId) ?? (isMe ? "Вы" : "Участник"))
            : displayName;
          const senderAvatarUrl = isDm
            ? (chat?.otherMember?.avatarUrl ?? null)
            : (chat?.members?.find((m) => m.id === msg.senderId)?.avatarUrl ?? null);
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
            const callerMember = callerId ? chat?.members?.find((m) => m.id === callerId) : undefined;
            const otherDm =
              chat?.type === "dm" && chat.otherMember?.id === callerId ? chat.otherMember : undefined;
            const redialPeer = callerMember ?? otherDm;
            const redialName = redialPeer
              ? [redialPeer.displayName, redialPeer.surname].filter(Boolean).join(" ").trim() || null
              : chat?.type === "dm"
                ? displayName
                : null;
            const redialAvatar = redialPeer?.avatarUrl ?? undefined;
            return (
              <div key={msg.id} data-message-id={msg.id} data-created-at={msg.createdAt} className="flex justify-center my-2">
                <div className="bg-secondary/50 text-muted-foreground text-[12px] px-4 py-2 rounded-xl flex flex-col items-center gap-2">
                  <span>{iAmCallee ? "Пропущенный звонок" : "Звонок не принят"}</span>
                  {iAmCallee && callerId && (
                    <button
                      type="button"
                      className="text-primary font-medium hover:underline"
                      onClick={() => startCallUnlessInGroup(callerId, redialName, chatId, video, redialAvatar ?? null)}
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
              <div key={msg.id} data-message-id={msg.id} data-created-at={msg.createdAt} className="flex justify-center my-2">
                <span className="bg-secondary/50 text-muted-foreground text-[11px] px-3 py-1 rounded-full text-center">
                  {msg.content}
                </span>
              </div>
            );
          }
          return (
            <div key={msg.id} data-message-id={msg.id} data-created-at={msg.createdAt}>
            <ChatMessageRow
              msg={msg}
              isFirstInGroup={isFirstInGroup}
              isLastInGroup={isLastInGroup}
              isMe={isMe}
              isDm={isDm}
              senderName={senderName}
              senderAvatarUrl={senderAvatarUrl}
              otherMemberId={chat.otherMember?.id ?? chat.id}
              lastReadAt={chat.otherMember?.lastReadAt ?? null}
              currentUserId={user?.id ?? ""}
              currentUserAvatarUrl={user?.avatarUrl ?? null}
              currentUserDisplayName={user?.displayName ?? "Вы"}
              messageBubbleColor={chatMsgColorPreset}
              chatVibeActive={vibe.isActive}
              pulseMobileDm={pulseDmMobileKind}
              pulseDmAccent={dmPulseAccent}
              isSelected={actions.selectedIds.has(msg.id)}
              isHighlighted={actions.highlightedMessageId === msg.id}
              isShattering={actions.shatteringMessageId === msg.id}
              showFooter={
                send?.editingId !== msg.id &&
                !(
                  pulseDmMobileKind &&
                  isMe &&
                  msg.type === "video_note" &&
                  msg.sendStatus !== "failed" &&
                  msg.sendStatus !== "sending"
                )
              }
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
              onOpenProfile={(id) =>
                setLocation(
                  buildProfilePath({
                    userId: id,
                    fallbackPath: "/",
                  })
                )
              }
              nextVoiceMessageId={msg.type === "voice" ? (nextVoiceByMessageId.get(msg.id) ?? null) : undefined}
              activeVoiceId={activeVoiceId}
              onVoiceEnded={(nextId) => setActiveVoiceId(nextId)}
              onOpenMedia={(src, type) => setMediaViewer({ src, type })}
              translatedText={translations.has(msg.id) && !showOriginalIds.has(msg.id) ? translations.get(msg.id)!.translatedText : undefined}
              translatedFromLang={
                translations.has(msg.id) && translations.get(msg.id)!.detectedLang !== "auto"
                  ? translations.get(msg.id)!.detectedLang
                  : undefined
              }
              onToggleOriginal={() => toggleOriginal(msg.id)}
            />
            </div>
          );
        });
        })()}
        <div ref={messagesEndRef} />
      </div>
      </div>{/* /vibe wrapper */}

      {!isNearBottom && (
        <div className="pointer-events-none absolute inset-x-0 z-[108]" style={{ bottom: "calc(var(--uix-chat-bottom-pad) + 4.25rem)" }}>
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

      {/* Контекстное меню сообщения — портал без Framer (motion+AnimatePresence в портале давали сбои на touch). */}
      {typeof document !== "undefined" && document.body
        ? createPortal(
        <ErrorBoundary
          fallback={(reset) => (
            <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 p-4" onClick={() => { actions.closeMenu(); reset(); }}>
              <div className="rounded-xl bg-background p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <p className="text-sm text-muted-foreground">Не удалось открыть меню</p>
                <button type="button" onClick={() => { actions.closeMenu(); reset(); }} className="mt-3 text-sm text-primary font-medium">
                  Закрыть
                </button>
              </div>
            </div>
          )}
        >
          {actions.messageMenu && (() => {
            const menu = actions.messageMenu;
            if (!menu?.msg?.id) return null;
            const left = Math.min(Math.max(menu.x - 8, 12), window.innerWidth - 212);
            const menuHeightEstimate = 280;
            const bottomSpace = 160;
            const openAbove = menu.y + menuHeightEstimate > window.innerHeight - bottomSpace;
            const top = openAbove ? undefined : menu.y - 10;
            const bottom = openAbove ? window.innerHeight - menu.y + 10 : undefined;
            return (
              <div
                key="message-menu"
                ref={actions.messageMenuRef}
                role="menu"
                aria-label="Действия с сообщением"
                className={cn(
                  "fixed min-w-[200px] max-h-[min(280px,60vh)] overflow-y-auto py-1 bg-background/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-xl",
                  !reducedMotion && "animate-in fade-in zoom-in-95 duration-200"
                )}
                style={{
                  left,
                  ...(openAbove ? { bottom } : { top }),
                  zIndex: 9999,
                }}
              >
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
                      aria-label={`Реакция ${emoji}`}
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
              {translations.has(menu.msg.id) && (
                <button
                  type="button"
                  onClick={() => {
                    toggleOriginal(menu.msg.id);
                    actions.closeMenu();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-secondary/80 transition-colors rounded-none"
                >
                  <Languages className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  {showOriginalIds.has(menu.msg.id) ? "Показать перевод" : "Показать оригинал"}
                </button>
              )}
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
                onClick={() => actions.handleAddToTrack(menu.msg)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-secondary/80 transition-colors rounded-none"
              >
                <List className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                В трек
              </button>
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
                  {(Date.now() - parseMessageDate(menu.msg.createdAt).getTime()) / 60_000 <= DELETE_FOR_EVERYONE_MINUTES && (
                    <button
                      type="button"
                      onClick={() => actions.handleDelete(menu.msg, true)}
                      className="w-full flex items-center gap-3 px-4 min-h-[var(--uix-touch-min)] py-2.5 text-left text-sm text-destructive hover:bg-destructive/10 active:bg-destructive/15 transition-colors rounded-none"
                      aria-label="Удалить сообщение для всех"
                    >
                      <Trash2 className="w-4 h-4 flex-shrink-0" />
                      Удалить для всех
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => actions.handleDelete(menu.msg, false)}
                    className="w-full flex items-center gap-3 px-4 min-h-[var(--uix-touch-min)] py-2.5 text-left text-sm text-destructive hover:bg-destructive/10 active:bg-destructive/15 transition-colors rounded-none"
                    aria-label="Удалить сообщение для себя"
                  >
                    <Trash2 className="w-4 h-4 flex-shrink-0" />
                    Удалить для себя
                  </button>
                </>
              )}
            </div>
              </div>
            );
          })()}
        </ErrorBoundary>,
        document.body
      )
        : null}

      {/* Модалка выбора трека для добавления сообщения */}
      <AddToTrackModal
        isOpen={!!actions.addToTrackMessage}
        onClose={() => actions.setAddToTrackMessage(null)}
        messageId={actions.addToTrackMessage?.id ?? ""}
        chatId={chatId}
      />

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

      {/* Input — Telegram-style тулбар: круги по краям, капсула по центру; цвета от темы (--chat-composer-*) */}
      <div
        ref={composerBarRef}
        className={cn("uix-content-x relative z-[105] shrink-0 chat-composer-bar pb-safe-offset-4", spacing.bottomBarYClass)}
      >
        {send?.editingId && (
          <div className="chat-composer-strip flex items-center justify-between gap-2 mb-1.5 rounded-t-xl border-b px-3 py-2">
            <span className="text-xs text-muted-foreground">Редактирование сообщения</span>
            <button type="button" onClick={send.handleCancelEdit} className="text-xs text-primary hover:underline rounded-lg px-1 py-0.5 min-h-[var(--uix-touch-min)]">
              Отмена
            </button>
          </div>
        )}
        {(typingDisplay || voiceRecordingDisplay) && !send?.editingId && (
          <div className="chat-composer-meta text-xs mb-1 space-y-0.5">
            {typingDisplay && <p className="animate-pulse">{typingDisplay} печатает...</p>}
            {voiceRecordingDisplay && <p className="animate-pulse">{voiceRecordingDisplay} записывает голосовое...</p>}
          </div>
        )}
        {/* Полоса записи: волшебный вид с волной, градиентом и мягким свечением */}
        {send?.voiceState === "recording" && !pulseDmComposerLikeTemplate && (
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
        <input
          ref={send.videoNoteInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="sr-only"
          aria-label="Записать или выбрать видеокружок"
          onChange={send.handleVideoNoteFile}
        />
        {/* overflow-visible: иначе обрезается ChatComposerSttPhaseOverlay над строкой ввода */}
        <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-0 overflow-visible">
          {send.replyingTo && (
            <div className="chat-composer-strip flex items-center gap-2 pl-3 pr-1 py-2 border-b text-[var(--uix-text-caption)] rounded-t-xl">
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
            <div className="chat-composer-strip chat-composer-strip--draft flex items-center gap-2 pl-3 pr-2 py-1.5 border-b text-[var(--uix-text-caption)] rounded-t-xl">
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
        {pulseDmMediaActive ? (
          <PulseDmComposerMedia
            accentColor={dmPulseAccent}
            reducedMotion={reducedMotion}
            allowSound={!reducedMotion}
            voiceState={send.voiceState}
            durationSec={send.durationSec ?? 0}
            voicePreviewUrl={send.voicePreviewUrl}
            voicePreviewDurationSec={send.voicePreviewDurationSec}
            voiceSupported={send.voiceSupported}
            sendingVoice={send.sendingVoice}
            discardVoiceRecording={() => void send.discardVoiceRecording()}
            finishVoiceRecordingClick={() => void send.handleMicClick()}
            cancelVoicePreview={send.cancelVoicePreview}
            sendRecordedVoice={() => void send.sendRecordedVoice()}
            rerecordVoiceFromPreview={() => void send.rerecordVoiceFromPreview()}
            videoNoteState={send.videoNoteState}
            videoNoteDurationSec={send.videoNoteDurationSec}
            videoNotePreviewUrl={send.videoNotePreviewUrl}
            videoNoteLocked={send.videoNoteLocked}
            sendingMedia={send.sendingMedia}
            setVideoNoteLiveElement={send.setVideoNoteLiveElement}
            cancelVideoNote={send.cancelVideoNote}
            stopVideoNoteRecording={() => void send.stopVideoNoteRecording()}
            sendRecordedVideoNote={() => void send.sendRecordedVideoNote()}
          />
        ) : (
        <div className="relative flex min-w-0 w-full items-end gap-2 overflow-visible pt-0.5">
          <ChatComposerSttPhaseOverlay phase={composerSttUi.phase} liveLine={composerSttUi.liveLine} />
          {showAttachSource && isNative() && (
            <div
              ref={attachSourceRef}
              className="absolute bottom-full left-0 mb-2 flex flex-col rounded-xl border border-border bg-popover text-popover-foreground shadow-lg py-1 z-[110]"
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
            className={cn("chat-composer-round chat-composer-attach flex-shrink-0")}
            aria-label="Прикрепить фото или видео"
          >
            <Paperclip className="h-[22px] w-[22px] pointer-events-none stroke-[1.85]" aria-hidden />
          </TapScaleButton>
          <div className="chat-composer-pill relative flex min-h-[var(--uix-touch-min)] min-w-0 flex-1 items-end overflow-x-hidden overflow-y-clip">
            {showCanvasCommandOption && (
              <div className="absolute bottom-full left-0 right-0 mb-1 z-[121]">
                <button
                  type="button"
                  onClick={() => {
                    triggerLightHaptic();
                    toast({ title: "Режим «Холст» включён. Добавь текст после ! и отправь" });
                    requestAnimationFrame(() => messageInputRef.current?.focus({ preventScroll: true }));
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-sm hover:bg-amber-500/15"
                  aria-label="Команда холст"
                >
                  <span className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <Code className="h-4 w-4" />
                    Холст
                  </span>
                  <span className="text-xs text-amber-700/80 dark:text-amber-300/80">добавь текст после !</span>
                </button>
              </div>
            )}
            {mentionOpen && chat?.type === "group" && chat.members && chat.members.length > 0 && (
              <div ref={mentionPickerRef} className="absolute bottom-full left-0 right-0 mb-1 z-[120]">
                <MentionPicker
                  members={chat.members}
                  query={mentionQuery}
                  selectedIndex={mentionSelectedIndex}
                  onSelectedIndexChange={setMentionSelectedIndex}
                  onSelect={(m) => {
                    const name = [m.displayName, m.surname].filter(Boolean).join(" ") || `ID ${m.publicId ?? ""}`;
                    const mentionText = `@[${name}](${m.publicId ?? m.id}) `;
                    const cursorPos = messageInputRef.current?.selectionStart ?? send.message.length;
                    const newCursor = send.insertMentionAtPosition(mentionStartPos, cursorPos, mentionText);
                    setMentionOpen(false);
                    pendingCursorRef.current = newCursor;
                    triggerLightHaptic();
                    requestAnimationFrame(() => messageInputRef.current?.focus({ preventScroll: true }));
                  }}
                />
              </div>
            )}
            <textarea
              ref={messageInputRef}
              value={send.message}
              onChange={(e) => {
                const value = e.target.value;
                const pos = e.target.selectionStart ?? value.length;
                send.setMessage(value);
                setDraftRestoredHint(false);
                if (!send?.editingId && value.trim().length > 0) scheduleSendTyping();
                requestAnimationFrame(syncComposerHeight);
                if (chat?.type === "group" && chat.members?.length) {
                  const beforeCursor = value.slice(0, pos);
                  const lastAt = beforeCursor.lastIndexOf("@");
                  if (lastAt >= 0) {
                    const afterAt = beforeCursor.slice(lastAt + 1);
                    if (!/[\s\n]/.test(afterAt)) {
                      setShowEmojiPicker(false);
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
                }
              }}
              onFocus={() => setDraftRestoredHint(false)}
              onKeyDown={(e) => {
                if (showCanvasCommandOption && e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  toast({ title: "Добавь текст после !, чтобы отправить «Холст»" });
                  return;
                }
                if (mentionOpen) {
                  if (e.key === "Escape") {
                    setMentionOpen(false);
                    e.preventDefault();
                    return;
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    const members = chat?.members ?? [];
                    const q = mentionQuery.trim().toLowerCase();
                    const filtered = q ? members.filter((m) => [m.displayName, m.surname].filter(Boolean).join(" ").toLowerCase().includes(q)) : members;
                    const maxIdx = Math.max(0, filtered.length - 1);
                    setMentionSelectedIndex((i) => Math.min(i + 1, maxIdx));
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setMentionSelectedIndex((i) => Math.max(0, i - 1));
                    return;
                  }
                  if (e.key === "Enter" && mentionQuery !== undefined) {
                    const members = chat?.members ?? [];
                    const q = mentionQuery.trim().toLowerCase();
                    const filtered = q ? members.filter((m) => [m.displayName, m.surname].filter(Boolean).join(" ").toLowerCase().includes(q)) : members;
                    const selected = filtered[Math.max(0, Math.min(mentionSelectedIndex, filtered.length - 1))];
                    if (selected) {
                      e.preventDefault();
                      const name = [selected.displayName, selected.surname].filter(Boolean).join(" ") || `ID ${selected.publicId ?? ""}`;
                      const mentionText = `@[${name}](${selected.publicId ?? selected.id}) `;
                      const cursorPos = messageInputRef.current?.selectionStart ?? send.message.length;
                      const newCursor = send.insertMentionAtPosition(mentionStartPos, cursorPos, mentionText);
                      setMentionOpen(false);
                      pendingCursorRef.current = newCursor;
                    }
                    return;
                  }
                }
                send.handleKeyPress(e);
              }}
              placeholder={
                send?.editingId ? "Измените текст и нажмите отправить" : "Сообщение..."
              }
              className={cn(
                "max-h-28 min-h-[36px] min-w-0 w-0 flex-1 resize-none overflow-x-auto border-none bg-transparent py-2 pl-3 text-[15px] leading-5 text-foreground outline-none placeholder:text-muted-foreground focus:ring-0 md:text-base",
                isDmChat ? "pr-2" : "pr-1",
                !send.message.trim() && "overflow-hidden whitespace-nowrap placeholder:whitespace-nowrap text-ellipsis"
              )}
              rows={1}
            />
            {isDmChat && (
              <ChatComposerSttButton
                embedded
                disabled={
                  Boolean(send.editingId) ||
                  send.sending ||
                  send.sendingMedia ||
                  send.voiceState === "recording" ||
                  Boolean(send.voicePreviewUrl)
                }
                allowSound={!reducedMotion}
                onUiChange={setComposerSttUi}
                onEmptyResult={() => {
                  toast({
                    title: "Не удалось распознать речь",
                    description: "Повторите попытку или проверьте доступ к микрофону.",
                  });
                }}
                onTranscript={(text) => {
                  send.setMessage((prev) => {
                    const t = prev.trim();
                    return t ? `${t} ${text}` : text;
                  });
                  setDraftRestoredHint(false);
                  requestAnimationFrame(() => {
                    messageInputRef.current?.focus({ preventScroll: true });
                    syncComposerHeight();
                  });
                }}
              />
            )}
            {!pulseDmComposerLikeTemplate && !send.message.trim() && !send?.editingId && (
              <TapScaleButton
                type="button"
                onClick={send.handleVideoNoteButtonClick}
                onPointerDown={send.handleVideoNotePointerDown}
                onPointerUp={send.handleVideoNotePointerUp}
                onPointerMove={send.handleVideoNotePointerMove}
                onPointerLeave={send.handleVideoNotePointerLeave}
                onPointerCancel={send.handleVideoNotePointerLeave}
                disabled={send.sendingMedia || !send.videoNoteSupported}
                haptic
                className="chat-composer-pill-action mr-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/6 dark:hover:bg-white/8 disabled:opacity-40"
                title="Видеокружок: нажмите для выбора, удерживайте для записи"
                aria-label="Видеокружок: нажмите для выбора, удерживайте для записи"
              >
                {send.sendingMedia ? <span className="text-[10px]">…</span> : <Video className="h-[20px] w-[20px]" strokeWidth={1.75} />}
              </TapScaleButton>
            )}
            {!pulseDmComposerLikeTemplate && (
              <TapScaleButton
                type="button"
                haptic
                data-active={showEmojiPicker ? "true" : undefined}
                className={cn(
                  "chat-composer-pill-action flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/6 dark:hover:bg-white/8",
                  showEmojiPicker && "bg-primary/12 text-primary"
                )}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                aria-label="Эмодзи"
              >
                <Smile className="h-[20px] w-[20px]" strokeWidth={1.75} />
              </TapScaleButton>
            )}
          </div>
          {pulseDmComposerLikeTemplate && !send.message.trim() && !send?.editingId && (
            <TapScaleButton
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!send.videoNoteSupported || send.sendingMedia) return;
                void send.startVideoNoteRecording();
              }}
              disabled={send.sendingMedia || !send.videoNoteSupported}
              haptic
              className="chat-composer-round chat-composer-video-round flex-shrink-0"
              title="Записать видеокружок"
              aria-label="Записать видеокружок"
            >
              {send.sendingMedia ? <span className="text-[10px]">…</span> : <Camera className="h-[18px] w-[18px]" strokeWidth={1.75} />}
            </TapScaleButton>
          )}
          {!isDmChat && (
            <ChatComposerSttButton
              disabled={
                Boolean(send.editingId) ||
                send.sending ||
                send.sendingMedia ||
                send.voiceState === "recording" ||
                Boolean(send.voicePreviewUrl)
              }
              allowSound={!reducedMotion}
              onUiChange={setComposerSttUi}
              onEmptyResult={() => {
                toast({
                  title: "Не удалось распознать речь",
                  description: "Повторите попытку или проверьте доступ к микрофону.",
                });
              }}
              onTranscript={(text) => {
                send.setMessage((prev) => {
                  const t = prev.trim();
                  return t ? `${t} ${text}` : text;
                });
                setDraftRestoredHint(false);
                requestAnimationFrame(() => {
                  messageInputRef.current?.focus({ preventScroll: true });
                  syncComposerHeight();
                });
              }}
            />
          )}
          {send.message.trim() ? (
            (() => {
            const handleCanvasSend = () => {
              const raw = send.message.slice(1);
              send.setMessage("```\n" + raw + "\n```");
              requestAnimationFrame(() => send.handleSend());
            };
            return (
              <div className="flex shrink-0 items-end gap-2">
              {isCanvasMode && (
                <div className="flex max-h-[var(--uix-touch-min)] items-center gap-1.5 self-end rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-600 dark:text-amber-400">
                  <Code className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold">Холст</span>
                </div>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <TapScaleButton
                    type="button"
                    haptic
                    className={cn(
                      "chat-composer-round",
                      send.scheduledAt && "border-primary/35 bg-primary/12 text-primary"
                    )}
                    aria-label="Отложенная отправка"
                    title={send.scheduledAt ? `Отправить в ${send.scheduledAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : "Отложить отправку"}
                  >
                    <Clock className="h-[20px] w-[20px]" strokeWidth={1.75} />
                  </TapScaleButton>
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className="w-52 p-1">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => { send.setScheduledAt(null); }}
                      className="flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md hover:bg-secondary"
                    >
                      <Check className={cn("w-4 h-4", !send.scheduledAt && "text-primary")} />
                      Сейчас
                    </button>
                    {[
                      { label: "В 18:00", getDate: () => { const d = new Date(); d.setHours(18, 0, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1); return d; } },
                      { label: "В 21:00", getDate: () => { const d = new Date(); d.setHours(21, 0, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1); return d; } },
                      { label: "Завтра 9:00", getDate: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
                    ].map(({ label, getDate }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => { send.setScheduledAt(getDate()); }}
                        className="flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md hover:bg-secondary"
                      >
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        {label}
                      </button>
                    ))}
                    <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50 mt-1 pt-1">
                      <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <input
                        type="datetime-local"
                        className="flex-1 min-w-0 bg-transparent text-sm outline-none"
                        min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) send.setScheduledAt(new Date(v));
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <TapScaleButton
                type="button"
                onClick={() => {
                  if (showCanvasCommandOption) {
                    toast({ title: "Добавь текст после !, чтобы отправить «Холст»" });
                    return;
                  }
                  if (isCanvasMode) {
                    handleCanvasSend();
                    return;
                  }
                  send.handleSend();
                }}
                disabled={send.sending}
                haptic
                className={cn(
                  "flex h-[var(--uix-touch-min)] w-[var(--uix-touch-min)] shrink-0 items-center justify-center rounded-full border border-transparent shadow-md transition-all duration-150 animate-in zoom-in-95 hover:brightness-110 active:scale-95 disabled:opacity-50",
                  isCanvasMode
                    ? "bg-gradient-to-br from-amber-600 to-amber-400 text-white shadow-amber-500/25"
                    : "bg-primary text-primary-foreground shadow-primary/20"
                )}
                title={isCanvasMode ? "Отправить холст" : send?.editingId ? "Сохранить изменения" : send.scheduledAt ? `Отправить в ${send.scheduledAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : "Отправить"}
              >
                {isCanvasMode ? <Code className="h-[20px] w-[20px]" /> : <Send className="h-[20px] w-[20px] translate-x-[-0.5px] translate-y-[0.5px]" strokeWidth={1.85} />}
              </TapScaleButton>
              </div>
            );
            })()
          ) : Boolean(send.voicePreviewUrl) ? (
            <span
              className="inline-flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] shrink-0"
              aria-hidden
            />
          ) : send.voiceState === "recording" ? (
            <TapScaleButton
              type="button"
              onClick={send.handleMicClick}
              haptic
              className="flex min-h-[var(--uix-touch-min)] min-w-[3.25rem] shrink-0 items-center justify-center gap-1 rounded-full border border-red-400/30 bg-red-500 px-2 text-white transition-all duration-150 active:scale-95 hover:bg-red-600"
              title="Остановить запись"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span className="text-[11px] font-semibold tabular-nums">{send.durationSec}с</span>
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
              className={cn(
                "shrink-0",
                isDmChat
                  ? cn(
                      "flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full border-2 border-red-400/60 bg-red-500 text-white shadow-[0_4px_20px_rgba(239,68,68,0.45)] transition-transform active:scale-95",
                      pulseDmComposerLikeTemplate && "chat-composer-mic-pulse",
                    )
                  : "chat-composer-round",
              )}
              title={!send.voiceSupported ? "Запись голоса недоступна в этом браузере" : "Удерживайте для записи голосового"}
              aria-label={!send.voiceSupported ? "Запись голоса недоступна" : "Удерживайте для записи голосового"}
            >
              {send.sendingVoice ? <span className="text-[10px]">…</span> : <Mic className="h-[22px] w-[22px] stroke-[1.85]" />}
            </TapScaleButton>
          )}
        </div>
        )}
        {spellUndo ? (
          <div className="chat-composer-spell-row flex items-center justify-center gap-1.5 py-1 px-2 border-t border-border/20">
            <span className="text-[10px] text-muted-foreground/60">Исправлено</span>
            <TapScaleButton
              type="button"
              onClick={handleSpellUndo}
              haptic
              className="text-[10px] text-muted-foreground/55 hover:text-muted-foreground/90 underline underline-offset-1 decoration-muted-foreground/30 hover:decoration-muted-foreground/60 min-h-[22px] px-1 -mx-1 rounded transition-colors"
              aria-label="Отменить исправление"
            >
              Отменить
            </TapScaleButton>
          </div>
        ) : effectiveSpellCheck ? (
          <SpellSuggestions
            errors={spellErrors}
            onReplace={handleSpellReplace}
            className={cn(headerPulseMobileDm && "chat-composer-spell-suggestions")}
          />
        ) : null}
        </div>
        {(send.voiceError || send.voiceRecorderError) && (
          <p className="text-[10px] text-destructive mt-0.5">{send.voiceError ?? send.voiceRecorderError}</p>
        )}
        {send.videoNoteError && (
          <p className="text-[10px] text-destructive mt-0.5">{send.videoNoteError}</p>
        )}
      </div>

      {send.voicePreviewUrl && !pulseDmMediaActive && (
        <div
          className="fixed inset-0 z-[141] flex flex-col items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Предпросмотр голосового сообщения"
        >
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-background/90 p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Голосовое сообщение</p>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {formatVideoNoteTime(send.voicePreviewDurationSec)}
              </span>
            </div>
            <audio
              src={send.voicePreviewUrl}
              controls
              className="mb-4 w-full"
              preload="metadata"
            />
            <div className="flex flex-wrap gap-2">
              <TapScaleButton
                type="button"
                onClick={send.cancelVoicePreview}
                className="min-h-[var(--uix-touch-min)] min-w-0 flex-1 rounded-xl border border-input bg-background"
              >
                Удалить
              </TapScaleButton>
              <TapScaleButton
                type="button"
                onClick={() => void send.rerecordVoiceFromPreview()}
                disabled={send.sendingVoice}
                className="min-h-[var(--uix-touch-min)] min-w-0 flex-1 rounded-xl bg-secondary text-foreground disabled:opacity-50"
              >
                Перезаписать
              </TapScaleButton>
              <TapScaleButton
                type="button"
                onClick={() => void send.sendRecordedVoice()}
                disabled={send.sendingVoice}
                haptic
                className="min-h-[var(--uix-touch-min)] min-w-0 flex-[1.15] rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
              >
                {send.sendingVoice ? "…" : "Отправить"}
              </TapScaleButton>
            </div>
          </div>
        </div>
      )}

      {(send.videoNoteState === "recording" || send.videoNoteState === "preview") && !pulseDmMediaActive && (
        <div className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm px-4 py-6 flex flex-col items-center justify-center">
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-background/90 p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold">
                {send.videoNoteState === "recording" ? "Запись видеокружка" : "Просмотр видеокружка"}
              </p>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {formatVideoNoteTime(send.videoNoteDurationSec)}
              </span>
            </div>
            {send.videoNoteState === "recording" && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-border/60 bg-muted/50 px-3 py-2 text-xs">
                {send.videoNoteLocked ? (
                  <span className="inline-flex items-center gap-1 font-medium text-primary">
                    <Lock className="h-3.5 w-3.5" />
                    Запись закреплена
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <ArrowUp className="h-3.5 w-3.5" />
                    Свайп вверх, чтобы закрепить
                  </span>
                )}
                <span className="text-muted-foreground">Отпускание: {send.videoNoteLocked ? "не останавливает" : "остановит"}</span>
              </div>
            )}
            <div className="mx-auto mb-4 flex items-center justify-center">
              <div className="relative h-[240px] w-[240px]">
                {send.videoNoteState === "recording" && (
                  <div
                    className="absolute inset-0 rounded-full animate-spin"
                    style={{
                      padding: "4px",
                      background:
                        "conic-gradient(from 0deg, hsl(var(--primary) / 0.95), hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.95))",
                    }}
                    aria-hidden
                  >
                    <div className="h-full w-full rounded-full bg-transparent" />
                  </div>
                )}
                <div className="absolute inset-[6px] overflow-hidden rounded-full bg-black">
                  {send.videoNoteState === "recording" ? (
                    <video
                      ref={send.setVideoNoteLiveElement}
                      className="h-full w-full object-cover"
                      style={{ transform: "scaleX(-1)" }}
                      autoPlay
                      muted
                      playsInline
                    />
                  ) : send.videoNotePreviewUrl ? (
                    <video
                      src={send.videoNotePreviewUrl}
                      className="h-full w-full object-cover"
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : null}
                </div>
              </div>
            </div>
            {send.videoNoteState === "recording" ? (
              <div className="flex gap-2">
                <TapScaleButton
                  type="button"
                  onClick={send.cancelVideoNote}
                  className="min-h-[var(--uix-touch-min)] flex-1 rounded-xl border border-input bg-background"
                >
                  Отмена
                </TapScaleButton>
                <TapScaleButton
                  type="button"
                  onClick={send.stopVideoNoteRecording}
                  haptic
                  className="min-h-[var(--uix-touch-min)] flex-1 rounded-xl bg-primary text-primary-foreground"
                >
                  Стоп
                </TapScaleButton>
              </div>
            ) : (
              <div className="flex gap-2">
                <TapScaleButton
                  type="button"
                  onClick={send.cancelVideoNote}
                  className="min-h-[var(--uix-touch-min)] flex-1 rounded-xl border border-input bg-background"
                >
                  Удалить
                </TapScaleButton>
                <TapScaleButton
                  type="button"
                  onClick={send.startVideoNoteRecording}
                  className="min-h-[var(--uix-touch-min)] flex-1 rounded-xl bg-secondary text-foreground"
                >
                  Перезаписать
                </TapScaleButton>
                <TapScaleButton
                  type="button"
                  onClick={send.sendRecordedVideoNote}
                  haptic
                  className="min-h-[var(--uix-touch-min)] flex-1 rounded-xl bg-primary text-primary-foreground"
                >
                  Отправить
                </TapScaleButton>
              </div>
            )}
          </div>
        </div>
      )}

      <MediaViewer
        open={!!mediaViewer}
        onClose={() => setMediaViewer(null)}
        src={mediaViewer?.src ?? ""}
        type={mediaViewer?.type ?? "image"}
      />
    </div>
  );
}
