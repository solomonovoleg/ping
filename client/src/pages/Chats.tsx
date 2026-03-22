import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import { flushSync } from "react-dom";
import { useLocation } from "wouter";
import {
  Search,
  Edit,
  MessageCircle,
  Phone,
  Video,
  X,
  UserPlus,
  ChevronLeft,
  ChevronUp,
  Mic,
  Pin,
  PinOff,
  Users,
  BookUser,
  Loader2,
  EyeOff,
  Trash2,
  Briefcase,
  Megaphone,
  Inbox,
  Heart,
  LayoutList,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/GlobalSearch";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { useChatRealtime } from "@/features/chat/hooks/useChatRealtime";

import { API, apiFetch } from "@/lib/api-base";
import {
  addContact,
  listContactsWithProfiles,
  matchContactsFromPhones,
  type ContactPhoneMatchUser,
  type ContactUser,
} from "@/lib/users";
import { gatherPhoneStringsFromDevice, isWebContactPickerSupported } from "@/lib/contact-book-match";
import { isNative, triggerContextMenuOpenFeedback } from "@/lib/capacitor-native";
import { ListEmptyState, ErrorWithRetry } from "@/components/ui/empty";
import { LoadingProgress } from "@/components/ui/loading-progress";
import { PageTitle } from "@/components/PageTitle";
import { PullToRefresh } from "@/components/PullToRefresh";
import { TapScaleButton, TapScaleDiv } from "@/components/ui/tap-scale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { startDm, createGroupChat } from "@/lib/search";
import {
  searchMessages,
  patchChatMemberMe,
  deleteChatForMe,
  deleteChatForEveryone,
  getServiceChatThread,
  setServiceChatLocalReplies,
  type ServiceChatThreadMeta,
  type SearchMessageHit,
} from "@/lib/chat";
import { AI_CHAT_ID } from "@/features/chat/constants";
import type { ApiChat } from "@/features/chat";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { playDeleteSound } from "@/lib/send-sound";
import { usePrefersReducedMotion } from "@/lib/motion";
import {
  DURATION_NORMAL_S,
  DURATION_FAST_MS,
  DURATION_EMPHASIS_MS,
  EASING_OUT_BEZIER,
} from "@/lib/motion";
import { formatTimeLocal, formatDateShortLocal, parseServerTimestamp } from "@/lib/timezone";
import { getOfflineChatList, saveOfflineChatList } from "@/lib/chat-offline-store";

/** Формат статуса «в сети» / «был(а) недавно» / «был(а) в HH:MM» (локальное время). */
function formatLastSeen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = parseServerTimestamp(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = diffMs / 60000;
  if (diffMin < 2) return "в сети";
  if (diffMin < 60) return "был(а) недавно";
  const diffHours = diffMin / 60;
  if (diffHours < 24) return `был(а) в ${formatTimeLocal(d)}`;
  if (diffHours < 48) return "был(а) вчера";
  return `был(а) ${formatDateShortLocal(d)}`;
}

async function fetchChats(): Promise<ApiChat[]> {
  try {
    const res = await apiFetch(`${API}/chats`, { cache: "no-store" });
    if (!res.ok) throw new Error("Не удалось загрузить чаты");
    const chats = (await res.json()) as ApiChat[];
    void saveOfflineChatList("all", Array.isArray(chats) ? chats : []);
    return Array.isArray(chats) ? chats : [];
  } catch {
    const cached = await getOfflineChatList("all");
    if (cached.length > 0) return cached;
    throw new Error("Не удалось загрузить чаты");
  }
}

async function fetchHiddenChats(): Promise<ApiChat[]> {
  try {
    const res = await apiFetch(`${API}/chats?hidden=1`, { cache: "no-store" });
    if (!res.ok) throw new Error("Не удалось загрузить скрытые чаты");
    const chats = (await res.json()) as ApiChat[];
    void saveOfflineChatList("hidden", Array.isArray(chats) ? chats : []);
    return Array.isArray(chats) ? chats : [];
  } catch {
    return getOfflineChatList("hidden");
  }
}

/** Согласованно с бейджем в списке: число и/или флаг с сервера. */
function effectiveUnreadCount(chat: ApiChat): number {
  const rawUnc = (chat as { unread_count?: unknown }).unread_count;
  return Math.max(
    0,
    Number(
      chat.unreadCount ??
        (typeof rawUnc === "number" ? rawUnc : typeof rawUnc === "string" ? parseInt(rawUnc, 10) : 0),
    ) || 0,
  );
}

function chatHasUnread(chat: ApiChat): boolean {
  return effectiveUnreadCount(chat) > 0 || chat.hasUnread === true;
}

/** Удержание для сервисного меню (~0,7 с). Сильный сдвиг пальца отменяет, чтобы не мешать скроллу. */
const CHAT_SERVICE_MENU_LONG_PRESS_MS = 720;
const CHAT_ROW_LONG_PRESS_MOVE_CANCEL_PX = 14;

const LIST_SECTION_TABS = [
  { id: "all" as const, label: "Все", icon: LayoutList },
  { id: "friends" as const, label: "Друзья", icon: Heart },
  { id: "work" as const, label: "Работа", icon: Briefcase },
  { id: "promo" as const, label: "Реклама", icon: Megaphone },
  { id: "invitations" as const, label: "Приглашения", icon: Inbox },
];

function formatChatTime(createdAt: string): string {
  const d = parseServerTimestamp(createdAt);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return formatTimeLocal(d);
  if (diff < 172800000) return "Вчера";
  return formatDateShortLocal(d);
}

type DateSectionKey = "today" | "yesterday" | "week" | "earlier";
const DATE_SECTION_ORDER: DateSectionKey[] = ["today", "yesterday", "week", "earlier"];
const DATE_SECTION_LABELS: Record<DateSectionKey, string> = {
  today: "Сегодня",
  yesterday: "Вчера",
  week: "На этой неделе",
  earlier: "Ранее",
};

function getDateSectionKey(iso: string): DateSectionKey {
  const d = parseServerTimestamp(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const weekAgo = startOfToday - 7 * 86400000;
  const t = d.getTime();
  if (t >= startOfToday) return "today";
  if (t >= startOfYesterday) return "yesterday";
  if (t >= weekAgo) return "week";
  return "earlier";
}

function groupChatsByDateSection(chats: ApiChat[]): Map<DateSectionKey, ApiChat[]> {
  const map = new Map<DateSectionKey, ApiChat[]>();
  for (const chat of chats) {
    const key = getDateSectionKey(chat.lastMessage?.createdAt ?? chat.createdAt);
    const list = map.get(key) ?? [];
    list.push(chat);
    map.set(key, list);
  }
  return map;
}

function contactDisplayName(c: ContactUser): string {
  const name = [c.displayName, c.surname].filter(Boolean).join(" ").trim();
  return name || `ID ${c.publicId}`;
}

function contactLetter(c: ContactUser): string {
  const name = contactDisplayName(c);
  const char = name[0]?.toUpperCase();
  return char && /[A-ZА-Я0-9]/.test(char) ? char : "?";
}

const TYPING_PREVIEW_TTL_MS = 5000;
const VOICE_RECORDING_PREVIEW_TTL_MS = 6000;

/** Превью в списке чатов: не показывать сырые пути /uploads/… */
function formatChatLastMessagePreview(last: { type: string; content: string } | null | undefined): string {
  if (!last) return "Нет сообщений";
  const { type, content } = last;
  const c = typeof content === "string" ? content : "";
  if (type === "voice") return "Голосовое сообщение";
  if (type === "image") return "Фото";
  if (type === "video") return "Видео";
  if (type === "video_note") return "Видеокружок";
  if (type === "file" || type === "document") return "Файл";
  if (type === "text" || !type) {
    const t = c.trim();
    if (!t) return "Сообщение";
    if (t.startsWith("/uploads/") || t.startsWith("http://") || t.startsWith("https://")) {
      if (t.includes("/voice/") || /\.(webm|m4a|ogg|opus|wav)(\?|$)/i.test(t)) return "Голосовое сообщение";
      if (t.includes("/chat/") || t.includes("/image") || /\.(jpe?g|png|gif|webp)(\?|$)/i.test(t)) return "Фото";
      if (t.includes("/video/") || /\.(mp4|mov|webm)(\?|$)/i.test(t)) return "Видео";
      return "Вложение";
    }
    return c;
  }
  return "Сообщение";
}

/** Строка чата: мемоизация уменьшает перерисовку списка при обновлении «печатает»/«записывает» только в одном чате */
const ChatRow = memo(function ChatRow({
  chat,
  typingLabel,
  voiceLabel,
  onSelect,
  onLongPressMenu,
  isAiChat,
  /** Скрытые / архив: без бейджа непрочитанного и яркого акцента (как «без уведомлений» в списке). */
  suppressUnreadVisual,
}: {
  chat: ApiChat;
  typingLabel: string | null;
  voiceLabel: string | null;
  onSelect: () => void;
  /** Удержание ~3 с — сервисное меню (не для AI-чата). */
  onLongPressMenu?: () => void;
  isAiChat?: boolean;
  suppressUnreadVisual?: boolean;
}) {
  const rawUnc = (chat as { unread_count?: unknown }).unread_count;
  const unreadCount = Math.max(
    0,
    Number(
      chat.unreadCount ??
        (typeof rawUnc === "number" ? rawUnc : typeof rawUnc === "string" ? parseInt(rawUnc, 10) : 0),
    ) || 0,
  );
  const hasUnreadVisual =
    !isAiChat && !suppressUnreadVisual && (unreadCount > 0 || chat.hasUnread === true);

  const reducedMotion = usePrefersReducedMotion();
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const blockClickRef = useRef(false);
  const [pressing, setPressing] = useState(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setPressing(false);
    longPressOriginRef.current = null;
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onLongPressMenu || isAiChat) return;
      if (e.button !== 0) return;
      longPressOriginRef.current = { x: e.clientX, y: e.clientY };
      setPressing(true);
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        setPressing(false);
        longPressOriginRef.current = null;
        blockClickRef.current = true;
        window.setTimeout(() => {
          blockClickRef.current = false;
        }, 500);
        try {
          window.getSelection()?.removeAllRanges();
        } catch {
          /* ignore */
        }
        triggerContextMenuOpenFeedback();
        onLongPressMenu();
      }, CHAT_SERVICE_MENU_LONG_PRESS_MS);
    },
    [onLongPressMenu, isAiChat],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const origin = longPressOriginRef.current;
    if (!origin || !longPressTimerRef.current) return;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    if (dx * dx + dy * dy > CHAT_ROW_LONG_PRESS_MOVE_CANCEL_PX * CHAT_ROW_LONG_PRESS_MOVE_CANCEL_PX) {
      clearLongPress();
    }
  }, [clearLongPress]);
  const preview =
    voiceLabel != null ? (
      <span className="text-primary/90 flex items-center gap-1">
        <Mic className="w-3 h-3 flex-shrink-0" />
        {voiceLabel} записывает голосовое
      </span>
    ) : typingLabel != null ? (
      <span className="italic text-primary/90">{typingLabel} печатает...</span>
    ) : (
      formatChatLastMessagePreview(chat.lastMessage ?? undefined)
    );
  const content = (
    <>
      <div
        className={cn(
          "rounded-full p-[2px] transition-transform duration-200",
          chat.otherMemberHasUnseenStory && !isAiChat
            ? "bg-gradient-to-tr from-primary via-fuchsia-500 to-purple-500 animate-story-ring"
            : chat.otherMemberHasActiveStory && !isAiChat
              ? "bg-gradient-to-tr from-primary/75 to-purple-400/70"
              : "bg-transparent"
        )}
      >
        <UserAvatar
          avatarUrl={(chat.type === "group" ? chat.avatarUrl : chat.otherMemberAvatarUrl) ?? undefined}
          displayName={chat.name ?? "Диалог"}
          seed={chat.id}
          size={46}
          className={cn("h-[46px] w-[46px] flex-shrink-0 sm:h-[50px] sm:w-[50px]", isAiChat && "ring-2 ring-indigo-400/60 ring-offset-2 ring-offset-indigo-500/10")}
          showOnlineIndicator={chat.type === "dm" && !isAiChat}
          lastSeenAt={chat.otherMemberLastSeenAt ?? undefined}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-1.5">
          <h3
            className={cn(
              "flex min-w-0 items-center gap-1 text-[15px] font-semibold leading-5 sm:text-[16px]",
              isAiChat && "text-indigo-700 dark:text-indigo-200",
              hasUnreadVisual && "text-foreground"
            )}
          >
            {chat.pinnedAt ? (
              <Pin className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden />
            ) : null}
            <span className="truncate">{chat.name ?? (chat.type === "dm" ? "Диалог" : "Чат")}</span>
          </h3>
          <span className="flex-shrink-0 text-[11px] text-muted-foreground/90 sm:text-xs">
            {formatChatTime(chat.lastMessage?.createdAt ?? chat.createdAt)}
          </span>
        </div>
        <p
          className={cn(
            "mt-0.5 truncate text-[13px] leading-[1.25rem] sm:text-[13.5px]",
            isAiChat ? "text-indigo-600/90 dark:text-indigo-400/90" : hasUnreadVisual ? "text-foreground/80 font-medium" : "text-muted-foreground"
          )}
        >
          {preview}
        </p>
      </div>
    </>
  );

  if (isAiChat) {
    return (
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
        className="rounded-xl sm:rounded-2xl border border-indigo-500/12 bg-indigo-500/8 transition-colors duration-150 hover:bg-indigo-500/12"
      >
        <TapScaleDiv
          onClick={onSelect}
          className="uix-list-row flex min-h-[52px] cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors duration-75 hover:bg-indigo-500/8 sm:min-h-[var(--uix-touch-min)] sm:gap-3 sm:rounded-2xl sm:px-2.5 sm:py-2.5"
        >
          {content}
        </TapScaleDiv>
      </motion.div>
    );
  }

  const hasUnread = hasUnreadVisual;
  const badgeLabel = unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : "";
  const showUnreadDot = hasUnread && !badgeLabel;

  return (
    <motion.div
      className="rounded-xl sm:rounded-2xl"
      animate={
        reducedMotion
          ? undefined
          : {
              scale: pressing ? 0.985 : 1,
              opacity: pressing ? 0.92 : 1,
            }
      }
      transition={
        reducedMotion ? undefined : { duration: DURATION_NORMAL_S * 0.85, ease: EASING_OUT_BEZIER }
      }
    >
      <TapScaleDiv
        onClick={() => {
          if (blockClickRef.current) return;
          onSelect();
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearLongPress}
        onPointerLeave={clearLongPress}
        onPointerCancel={clearLongPress}
        className={cn(
          "uix-list-row flex min-h-[52px] cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors duration-75 sm:min-h-[var(--uix-touch-min)] sm:gap-3 sm:rounded-2xl sm:px-2.5 sm:py-2.5",
          /* Long-press меню: без этого WebKit даёт выделение/«копировать» вместо жеста */
          "select-none [-webkit-touch-callout:none]",
          "border-border/20 hover:bg-secondary/40 touch-pan-y",
          suppressUnreadVisual
            ? "border-dashed border-border/35 bg-card/45 opacity-[0.92] hover:bg-secondary/35 dark:bg-card/40"
            : hasUnread
              ? "bg-secondary/60 hover:bg-secondary/70 dark:bg-secondary/45 dark:hover:bg-secondary/55"
              : "bg-card/60 hover:bg-secondary/50"
        )}
      >
        {content}
        {badgeLabel ? (
          <span
            className="flex-shrink-0 inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-none text-primary-foreground"
            aria-label={`${unreadCount} непрочитанных`}
          >
            {badgeLabel}
          </span>
        ) : showUnreadDot ? (
          <span
            className="flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary"
            aria-label="Есть непрочитанные сообщения"
            title="Непрочитанные"
          />
        ) : null}
      </TapScaleDiv>
    </motion.div>
  );
});

export default function Chats() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showContactsPage, setShowContactsPage] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [groupCreateLoading, setGroupCreateLoading] = useState(false);
  const [contactsSearchQuery, setContactsSearchQuery] = useState("");
  const [contactOpeningId, setContactOpeningId] = useState<string | null>(null);
  const [addressBookMatches, setAddressBookMatches] = useState<ContactPhoneMatchUser[]>([]);
  const [addressBookLoading, setAddressBookLoading] = useState(false);
  const [addressBookError, setAddressBookError] = useState<string | null>(null);
  const [typingByChatId, setTypingByChatId] = useState<Record<string, string | null>>({});
  const [voiceRecordingByChatId, setVoiceRecordingByChatId] = useState<Record<string, string | null>>({});
  const [messageSearchResults, setMessageSearchResults] = useState<SearchMessageHit[]>([]);
  const [messageSearchLoading, setMessageSearchLoading] = useState(false);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const voiceTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { subscribeChat, subscribeTyping, subscribeVoiceRecording, notifyChatListUpdate } = useChatRealtime();

  const { data: chats = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["chats"],
    queryFn: fetchChats,
    refetchOnMount: "always",
  });

  const [listSectionTab, setListSectionTab] = useState<"all" | "friends" | "work" | "promo" | "invitations">("all");
  /** Полоса скрытых чатов вверху списка после pull-to-refresh (если есть скрытые). */
  const [hiddenPeekOpen, setHiddenPeekOpen] = useState(false);
  const [serviceMenuChat, setServiceMenuChat] = useState<ApiChat | null>(null);
  const [serviceThreadMeta, setServiceThreadMeta] = useState<ServiceChatThreadMeta | null>(null);
  const [serviceThreadLoading, setServiceThreadLoading] = useState(false);
  const [confirmDeleteAllChat, setConfirmDeleteAllChat] = useState<ApiChat | null>(null);
  const [confirmLeaveChat, setConfirmLeaveChat] = useState<ApiChat | null>(null);
  /** Удаление из диалога — кнопка без авто-закрытия Radix Action, чтобы дождаться API. */
  const [deleteInProgress, setDeleteInProgress] = useState<null | "leave" | "forAll">(null);
  const chatListReducedMotion = usePrefersReducedMotion();

  const { data: hiddenChats = [], isLoading: hiddenLoading, refetch: refetchHidden } = useQuery({
    queryKey: ["chats", "hidden"],
    queryFn: fetchHiddenChats,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (hiddenPeekOpen && !hiddenLoading && hiddenChats.length === 0) {
      setHiddenPeekOpen(false);
    }
  }, [hiddenPeekOpen, hiddenLoading, hiddenChats.length]);

  // Подписка на все чаты: новые сообщения → обновить список; типинг и запись ГС → показать в превью
  useEffect(() => {
    if (!chats.length) return;
    const unsubs: Array<() => void> = [];
    chats.forEach((chat) => {
      const chatId = chat.id;
      unsubs.push(
        subscribeChat(chatId, () => {
          notifyChatListUpdate();
          void queryClient.invalidateQueries({ queryKey: ["chats"] });
        })
      );
      unsubs.push(
        subscribeTyping(chatId, (userId, displayName) => {
          if (userId === user?.id) return;
          const name = displayName?.trim() || "Кто-то";
          flushSync(() => setTypingByChatId((prev) => ({ ...prev, [chatId]: name })));
          if (typingTimeoutsRef.current[chatId]) clearTimeout(typingTimeoutsRef.current[chatId]);
          typingTimeoutsRef.current[chatId] = setTimeout(() => {
            setTypingByChatId((prev) => {
              const next = { ...prev };
              delete next[chatId];
              return next;
            });
            delete typingTimeoutsRef.current[chatId];
          }, TYPING_PREVIEW_TTL_MS);
        })
      );
      unsubs.push(
        subscribeVoiceRecording(chatId, (userId, displayName, recording) => {
          if (userId === user?.id) return;
          if (voiceTimeoutsRef.current[chatId]) {
            clearTimeout(voiceTimeoutsRef.current[chatId]);
            delete voiceTimeoutsRef.current[chatId];
          }
          if (recording) {
            const name = displayName?.trim() || "Кто-то";
            flushSync(() => setVoiceRecordingByChatId((prev) => ({ ...prev, [chatId]: name })));
            voiceTimeoutsRef.current[chatId] = setTimeout(() => {
              setVoiceRecordingByChatId((prev) => {
                const next = { ...prev };
                delete next[chatId];
                return next;
              });
              delete voiceTimeoutsRef.current[chatId];
            }, VOICE_RECORDING_PREVIEW_TTL_MS);
          } else {
            flushSync(() =>
              setVoiceRecordingByChatId((prev) => {
                const next = { ...prev };
                delete next[chatId];
                return next;
              })
            );
          }
        })
      );
    });
    return () => {
      unsubs.forEach((f) => f());
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};
      Object.values(voiceTimeoutsRef.current).forEach(clearTimeout);
      voiceTimeoutsRef.current = {};
    };
  }, [chats, user?.id, location, queryClient, subscribeChat, subscribeTyping, subscribeVoiceRecording, notifyChatListUpdate]);

  const { data: contactsList = [] } = useQuery({
    queryKey: ["contacts", "list"],
    queryFn: listContactsWithProfiles,
    enabled: showContactsPage || showCreateGroupModal,
  });

  const syncAddressBookMatches = useCallback(async () => {
    setAddressBookLoading(true);
    setAddressBookError(null);
    try {
      const { phones, source } = await gatherPhoneStringsFromDevice();
      if (phones.length === 0) {
        setAddressBookMatches([]);
        if (source === "native") {
          toast({
            title: "Нет номеров для проверки",
            description: "Разрешите доступ к контактам или проверьте книгу (нужны номера РФ: +7…).",
          });
        } else {
          toast({
            title: isWebContactPickerSupported() ? "Контакты не выбраны" : "Недоступно в этом браузере",
            description: isWebContactPickerSupported()
              ? undefined
              : "Используйте приложение PING или Chrome на Android.",
          });
        }
        return;
      }
      const matches = await matchContactsFromPhones(phones);
      setAddressBookMatches(matches);
      if (matches.length === 0) {
        toast({
          title: "Пока никого нет в Ping",
          description: "Среди переданных номеров нет зарегистрированных пользователей.",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось проверить контакты";
      setAddressBookError(msg);
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setAddressBookLoading(false);
    }
  }, [toast]);

  // Поиск по сообщениям (с задержкой)
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setMessageSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      setMessageSearchLoading(true);
      searchMessages(q)
        .then(setMessageSearchResults)
        .catch(() => setMessageSearchResults([]))
        .finally(() => setMessageSearchLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const searchLower = searchQuery.toLowerCase().trim();
  const filteredChats =
    searchLower === ""
      ? chats
      : chats.filter(
          (c) =>
            (c.name ?? "").toLowerCase().includes(searchLower)
        );

  /** Вкладки «Друзья / Работа / …» показываем только если пользователь уже вынес хотя бы один чат из «Общих». */
  const hasCustomListSections = useMemo(
    () => chats.some((c) => (c.listSection ?? "general") !== "general"),
    [chats],
  );

  useEffect(() => {
    if (!hasCustomListSections && listSectionTab !== "all") {
      setListSectionTab("all");
    }
  }, [hasCustomListSections, listSectionTab]);

  const filteredBySection = useMemo(() => {
    if (listSectionTab === "all") {
      // Service chats stay in dedicated section only.
      return filteredChats.filter((c) => (c.listSection ?? "general") !== "invitations");
    }
    return filteredChats.filter((c) => (c.listSection ?? "general") === listSectionTab);
  }, [filteredChats, listSectionTab]);

  const chatsSortedByLastMessage = useMemo(() => {
    return [...filteredBySection].sort((a, b) => {
      const ap = a.pinnedAt ? 1 : 0;
      const bp = b.pinnedAt ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const aTs = Date.parse(a.lastMessage?.createdAt ?? a.createdAt) || 0;
      const bTs = Date.parse(b.lastMessage?.createdAt ?? b.createdAt) || 0;
      if (aTs !== bTs) return bTs - aTs;
      return 0;
    });
  }, [filteredBySection]);

  const refreshChatQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["chats"] });
    void queryClient.invalidateQueries({ queryKey: ["chats", "hidden"] });
    notifyChatListUpdate();
  }, [queryClient, notifyChatListUpdate]);

  const revealHiddenPeekIfAny = useCallback(() => {
    void (async () => {
      try {
        const list = await queryClient.fetchQuery({
          queryKey: ["chats", "hidden"],
          queryFn: fetchHiddenChats,
        });
        if (Array.isArray(list) && list.length > 0) {
          setHiddenPeekOpen(true);
        }
      } catch {
        /* тихо: сеть может быть недоступна */
      }
    })();
  }, [queryClient]);

  const openLeaveChatConfirm = useCallback((c: ApiChat) => {
    setServiceMenuChat(null);
    requestAnimationFrame(() => setConfirmLeaveChat(c));
  }, []);

  const openDeleteForAllConfirm = useCallback((c: ApiChat) => {
    setServiceMenuChat(null);
    requestAnimationFrame(() => setConfirmDeleteAllChat(c));
  }, []);

  useEffect(() => {
    if (!serviceMenuChat) {
      setServiceThreadMeta(null);
      setServiceThreadLoading(false);
      return;
    }
    setServiceThreadLoading(true);
    getServiceChatThread(serviceMenuChat.id)
      .then((meta) => setServiceThreadMeta(meta))
      .catch(() => setServiceThreadMeta(null))
      .finally(() => setServiceThreadLoading(false));
  }, [serviceMenuChat]);

  const runDeleteLeave = useCallback(async () => {
    const chat = confirmLeaveChat;
    if (!chat || deleteInProgress) return;
    setDeleteInProgress("leave");
    try {
      await deleteChatForMe(chat.id);
      playDeleteSound();
      setConfirmLeaveChat(null);
      refreshChatQueries();
      toast({ title: "Чат убран из списка" });
    } catch (e) {
      toast({
        title: "Не получилось удалить",
        description: e instanceof Error ? e.message : "Повторите позже",
        variant: "destructive",
      });
    } finally {
      setDeleteInProgress(null);
    }
  }, [confirmLeaveChat, deleteInProgress, refreshChatQueries, toast]);

  const runDeleteForAll = useCallback(async () => {
    const chat = confirmDeleteAllChat;
    if (!chat || deleteInProgress) return;
    setDeleteInProgress("forAll");
    try {
      await deleteChatForEveryone(chat.id);
      playDeleteSound();
      setConfirmDeleteAllChat(null);
      refreshChatQueries();
      toast({ title: "Чат удалён" });
    } catch (e) {
      toast({
        title: "Не получилось удалить",
        description: e instanceof Error ? e.message : "Повторите позже",
        variant: "destructive",
      });
    } finally {
      setDeleteInProgress(null);
    }
  }, [confirmDeleteAllChat, deleteInProgress, refreshChatQueries, toast]);

  const showAiOver = searchLower === "" || "ai over".includes(searchLower);
  const aiOverChat: ApiChat = {
    id: AI_CHAT_ID,
    type: "dm",
    name: "AI OVER",
    createdAt: new Date().toISOString(),
    otherMemberAvatarUrl: "/ai-over-avatar.png",
    lastMessage: { type: "text", content: "Чат с ИИ по любым вопросам", createdAt: new Date().toISOString() },
  };

  const contactsSearchLower = contactsSearchQuery.toLowerCase().trim();
  const filteredContacts = contactsSearchLower
    ? contactsList.filter((c) =>
        contactDisplayName(c).toLowerCase().includes(contactsSearchLower) ||
        String(c.publicId).includes(contactsSearchLower)
      )
    : contactsList;
  const groupedContacts = filteredContacts.reduce(
    (acc, contact) => {
      const letter = contactLetter(contact);
      if (!acc[letter]) acc[letter] = [];
      acc[letter].push(contact);
      return acc;
    },
    {} as Record<string, ContactUser[]>
  );

  // Экран контактов
  if (showContactsPage) {
    return (
      <div className="flex h-full w-full max-w-full min-w-0 overflow-x-hidden bg-background animate-in slide-in-from-right-4 duration-150">
        <div className="w-full flex flex-col h-full relative">
          {/* Contacts Header */}
          <div className="uix-content-x pt-6 pb-2 glass z-40 sticky top-0 border-b border-border/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TapScaleButton
                  type="button"
                  onClick={() => {
                    setShowContactsPage(false);
                    setContactsSearchQuery("");
                  }}
                  haptic
                  subtle
                  className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] p-2 -ml-2 rounded-full text-primary hover:bg-primary/10 transition-colors flex items-center justify-center"
                  aria-label="Назад к чатам"
                >
                  <ChevronLeft className="w-6 h-6" />
                </TapScaleButton>
                <h1 className="uix-text-title">Контакты</h1>
              </div>
              <TapScaleButton type="button" haptic subtle className="text-primary font-medium px-2 min-h-[var(--uix-touch-min)]" aria-label="Изменить контакты">
                Изм.
              </TapScaleButton>
            </div>

            <div className="relative mb-2">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Поиск контактов..." 
                value={contactsSearchQuery}
                onChange={(e) => setContactsSearchQuery(e.target.value)}
                className="w-full bg-secondary/50 border-none rounded-xl py-2.5 pl-10 pr-10 text-[15px] focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/70 outline-none"
              />
              {contactsSearchQuery && (
                <TapScaleButton
                  type="button"
                  onClick={() => setContactsSearchQuery("")}
                  subtle
                  className="absolute right-3 top-1/2 -translate-y-1/2 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] rounded-full bg-muted-foreground/20 flex items-center justify-center text-muted-foreground hover:bg-muted-foreground/30 transition-colors"
                  aria-label="Очистить поиск"
                >
                  <X className="w-3 h-3" />
                </TapScaleButton>
              )}
            </div>
          </div>

          {/* Contacts List */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))] uix-content-x">
            {!contactsSearchQuery && (
              <>
                <div className="rounded-2xl border border-border/40 bg-secondary/20 p-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <BookUser className="w-5 h-5 text-primary" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[15px]">Кто из контактов в Ping</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isNative()
                          ? "Синхронизация с телефонной книгой устройства"
                          : isWebContactPickerSupported()
                            ? "Выберите контакты в браузере (Chrome на Android)"
                            : "В вебе полной синхронизации нет — установите приложение"}
                      </p>
                    </div>
                    <TapScaleButton
                      type="button"
                      haptic
                      disabled={addressBookLoading}
                      onClick={() => void syncAddressBookMatches()}
                      className="shrink-0 min-h-[var(--uix-touch-min)] px-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                      aria-label={addressBookLoading ? "Проверка контактов" : "Синхронизировать контакты"}
                    >
                      {addressBookLoading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
                      {addressBookLoading ? "…" : "Синхронизировать"}
                    </TapScaleButton>
                  </div>
                  {addressBookError ? (
                    <p className="text-sm text-destructive mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>{addressBookError}</span>
                      <button
                        type="button"
                        onClick={() => void syncAddressBookMatches()}
                        className="min-h-[var(--uix-touch-min)] px-1 text-primary underline underline-offset-2"
                      >
                        Повторить
                      </button>
                    </p>
                  ) : null}
                </div>

                {addressBookMatches.length > 0 ? (
                  <div className="mb-4">
                    <div className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      В Ping из вашей книги
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {addressBookMatches.map((m) => (
                        <div
                          key={`ab-${m.id}`}
                          className="flex items-center justify-between p-3 hover:bg-secondary/50 rounded-2xl transition-colors group active:scale-[0.98]"
                        >
                          <button
                            type="button"
                            className="flex flex-1 min-w-0 items-center gap-3 text-left"
                            onClick={async () => {
                              if (contactOpeningId) return;
                              setContactOpeningId(m.id);
                              try {
                                const chat = await startDm(m.id);
                                setLocation(`/chat/${encodeURIComponent(chat.id)}`);
                                setShowContactsPage(false);
                              } finally {
                                setContactOpeningId(null);
                              }
                            }}
                          >
                            <UserAvatar
                              avatarUrl={m.avatarUrl ?? undefined}
                              displayName={contactDisplayName(m)}
                              seed={String(m.id)}
                              size={48}
                              className="w-12 h-12 shrink-0"
                            />
                            <div className="min-w-0">
                              <h3 className="font-semibold text-[16px] truncate">{contactDisplayName(m)}</h3>
                              <p className="text-sm text-muted-foreground">
                                {m.isInMyContacts ? "Уже в контактах" : "В Ping"}
                              </p>
                            </div>
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            {!m.isInMyContacts ? (
                              <TapScaleButton
                                type="button"
                                haptic
                                subtle
                                className="min-h-[var(--uix-touch-min)] px-2.5 text-sm text-primary font-medium"
                                aria-label={`Добавить ${contactDisplayName(m)} в контакты`}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await addContact(m.id);
                                    queryClient.invalidateQueries({ queryKey: ["contacts", "list"] });
                                    setAddressBookMatches((prev) =>
                                      prev.map((u) => (u.id === m.id ? { ...u, isInMyContacts: true } : u))
                                    );
                                    toast({ title: "Добавлено в контакты" });
                                  } catch (err) {
                                    toast({
                                      title: "Не удалось добавить",
                                      description: err instanceof Error ? err.message : undefined,
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                В контакты
                              </TapScaleButton>
                            ) : null}
                            <button
                              type="button"
                              className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                              aria-label={`Написать ${contactDisplayName(m)}`}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (contactOpeningId) return;
                                setContactOpeningId(m.id);
                                try {
                                  const chat = await startDm(m.id);
                                  setLocation(`/chat/${encodeURIComponent(chat.id)}`);
                                  setShowContactsPage(false);
                                } finally {
                                  setContactOpeningId(null);
                                }
                              }}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div
                  className="flex items-center gap-3 p-3 ml-1 mb-2 hover:bg-secondary/50 rounded-2xl cursor-pointer text-primary font-medium transition-colors"
                  onClick={() => {
                    setShowContactsPage(false);
                    setContactsSearchQuery("");
                  }}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  Добавить контакт (поиск в «Чаты»)
                </div>
              </>
            )}

            {Object.keys(groupedContacts).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-center">
                <p>Пока нет контактов</p>
                <p className="text-sm mt-1">Найдите пользователя через поиск в разделе «Чаты» и начните диалог</p>
              </div>
            ) : (
              Object.keys(groupedContacts)
                .sort()
                .map((letter) => (
                  <div key={letter} className="mb-2">
                    {!contactsSearchQuery && (
                      <div className="px-4 py-1 text-sm font-bold text-muted-foreground">
                        {letter}
                      </div>
                    )}
                    <div className="flex flex-col gap-0.5">
                      {groupedContacts[letter].map((contact) => (
                        <div
                          key={`contact-${contact.id}`}
                          className="flex items-center justify-between p-3 hover:bg-secondary/50 rounded-2xl cursor-pointer transition-colors group active:scale-[0.98]"
                          onClick={async () => {
                            if (contactOpeningId) return;
                            setContactOpeningId(contact.id);
                            try {
                              const chat = await startDm(contact.id);
                              setLocation(`/chat/${encodeURIComponent(chat.id)}`);
                              setShowContactsPage(false);
                            } finally {
                              setContactOpeningId(null);
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <UserAvatar avatarUrl={contact.avatarUrl ?? undefined} displayName={contactDisplayName(contact)} seed={String(contact.id)} size={48} className="w-12 h-12" />
                            <div>
                              <h3 className="font-semibold text-[16px]">{contactDisplayName(contact)}</h3>
                              <p className="text-sm text-muted-foreground">В контактах</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (contactOpeningId) return;
                                setContactOpeningId(contact.id);
                                try {
                                  const chat = await startDm(contact.id);
                                  setLocation(`/chat/${encodeURIComponent(chat.id)}`);
                                  setShowContactsPage(false);
                                } finally {
                                  setContactOpeningId(null);
                                }
                              }}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (contactOpeningId) return;
                                setContactOpeningId(contact.id);
                                try {
                                  const chat = await startDm(contact.id);
                                  setLocation(`/chat/${encodeURIComponent(chat.id)}`);
                                  setShowContactsPage(false);
                                } finally {
                                  setContactOpeningId(null);
                                }
                              }}
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (contactOpeningId) return;
                                setContactOpeningId(contact.id);
                                try {
                                  const chat = await startDm(contact.id);
                                  setLocation(`/chat/${encodeURIComponent(chat.id)}`);
                                  setShowContactsPage(false);
                                } finally {
                                  setContactOpeningId(null);
                                }
                              }}
                            >
                              <Video className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Экран чатов
  return (
        <div className="flex h-full w-full max-w-full min-w-0 overflow-x-hidden animate-in fade-in duration-150">
      <PageTitle title="Чаты" />
      <div className="w-full max-w-full min-w-0 flex flex-col h-full bg-background relative">
        
        {/* Header — компактно, как в TG: ~5px от краёв */}
        <div className="uix-content-x pt-safe-offset-2 pb-2 sm:pt-4 sm:pb-2.5 glass z-40 sticky top-0 border-b border-border/50">
          <div className="flex justify-between items-center mb-2">
            <span className="uix-text-title tracking-tight">Чаты</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors duration-75 active:scale-95"
                  title="Новый чат или группа"
                  aria-label="Новый чат или групповой чат"
                >
                  <Edit className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem
                  onClick={() => {
                    setShowContactsPage(true);
                  }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Новый чат
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setShowCreateGroupModal(true);
                    setGroupName("");
                    setSelectedMemberIds(new Set());
                  }}
                >
                  <Users className="w-4 h-4" />
                  Групповой чат
                </DropdownMenuItem>
                {hiddenChats.length > 0 ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setHiddenPeekOpen(true);
                      void refetchHidden();
                    }}
                  >
                    <EyeOff className="w-4 h-4" />
                    Скрытые чаты ({hiddenChats.length})
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Поиск по номеру, ID или имени..."
              className="[&_input]:h-11 [&_input]:rounded-xl [&_input]:bg-card/75 [&_input]:text-[15px] [&_input]:shadow-[inset_0_0_0_1px_hsl(var(--border)/0.5)] [&_input]:focus:ring-2 [&_input]:focus:ring-primary/25"
            />
            <button 
              onClick={() => setShowContactsPage(true)}
              className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors duration-75 flex-shrink-0 active:scale-95"
              title="Контакты"
              aria-label="Контакты"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* List Content — чаты в 5px от краёв, как в Telegram */}
        <PullToRefresh
          onRefresh={async () => {
            await Promise.all([refetch(), refetchHidden()]);
          }}
          onPastThresholdRelease={revealHiddenPeekIfAny}
          className="min-h-0"
          enableHoldRefresh={false}
        >
          <div className="uix-content-x py-2 sm:py-2.5 pb-[calc(var(--uix-nav-bottom)+var(--uix-space-3))] space-y-1">
            {hiddenPeekOpen && hiddenChats.length > 0 ? (
              <motion.div
                initial={chatListReducedMotion ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION_NORMAL_S * 0.85, ease: EASING_OUT_BEZIER }}
                className="mb-3 rounded-2xl border border-border/40 bg-muted/15 p-2.5 shadow-sm shadow-black/[0.05] dark:border-border/30 dark:bg-muted/10 dark:shadow-black/25"
              >
                <div className="mb-2 flex items-start justify-between gap-2 px-0.5">
                  <div className="flex min-w-0 items-start gap-2">
                    <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold leading-tight text-foreground/95">Скрытые чаты</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                        В основном списке не показываются и без счётчика непрочитанного. Нажмите — открыть переписку.
                      </p>
                    </div>
                  </div>
                  <TapScaleButton
                    type="button"
                    subtle
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/45 bg-background/70 p-0"
                    aria-label="Свернуть скрытые чаты"
                    onClick={() => setHiddenPeekOpen(false)}
                  >
                    <ChevronUp className="h-5 w-5 text-muted-foreground" aria-hidden />
                  </TapScaleButton>
                </div>
                <div className="max-h-[min(42dvh,340px)] space-y-1 overflow-y-auto overscroll-contain pr-0.5">
                  {hiddenChats.map((h) => (
                    <ChatRow
                      key={h.id}
                      chat={h}
                      typingLabel={null}
                      voiceLabel={null}
                      suppressUnreadVisual
                      onSelect={() => setLocation(`/chat/${encodeURIComponent(h.id)}`)}
                      onLongPressMenu={() => setServiceMenuChat(h)}
                    />
                  ))}
                </div>
              </motion.div>
            ) : null}
            {searchLower === "" && hasCustomListSections && (
              <div className="flex gap-1 overflow-x-auto pb-2 -mx-0.5 px-0.5 scrollbar-none">
                {LIST_SECTION_TABS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setListSectionTab(t.id)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0 transition-colors border min-h-[28px]",
                        listSectionTab === t.id
                          ? "bg-primary/12 border-primary/25 text-foreground"
                          : "bg-muted/25 border-border/30 text-muted-foreground hover:bg-muted/45"
                      )}
                    >
                      <Icon className="w-3 h-3 opacity-80 shrink-0" aria-hidden />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}
            {searchQuery.trim().length >= 2 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">В сообщениях</p>
                {messageSearchLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">Поиск...</div>
                ) : messageSearchResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Ничего не найдено</p>
                ) : (
                  <ul className="space-y-0.5 max-h-[200px] overflow-y-auto">
                    {messageSearchResults.map((hit) => (
                      <li key={`${hit.chatId}-${hit.messageId}`}>
                        <TapScaleDiv
                          onClick={() =>
                          setLocation(
                            `/chat/${encodeURIComponent(hit.chatId)}?messageId=${encodeURIComponent(hit.messageId)}`,
                          )
                        }
                          className="flex flex-col gap-0.5 p-2.5 rounded-lg hover:bg-secondary/50 cursor-pointer"
                        >
                          <span className="text-xs text-muted-foreground">{hit.chatName}</span>
                          <span className="text-sm truncate">{hit.content}</span>
                        </TapScaleDiv>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {isLoading ? (
              <LoadingProgress loading minHeight="200px" className="rounded-xl">
                <div className="min-h-[200px]" />
              </LoadingProgress>
            ) : isError ? (
              <ErrorWithRetry
                title="Не удалось загрузить чаты"
                description="Проверьте интернет и попробуйте снова"
                onRetry={() => refetch()}
              />
            ) : chatsSortedByLastMessage.length === 0 ? (
              <ListEmptyState
                icon={MessageCircle}
                title={
                  chats.length === 0
                    ? "У вас пока нет чатов"
                    : listSectionTab !== "all"
                      ? "Нет чатов на этой полке"
                      : "Нет чатов по запросу"
                }
                description={
                  chats.length === 0
                    ? "Найдите пользователя через поиск и начните диалог"
                    : listSectionTab !== "all"
                      ? "Назначьте полку через долгое нажатие на чат (меню) или выберите «Все»."
                      : "Измените поиск или выберите другой фильтр"
                }
                actionLabel={chats.length === 0 ? "Найти человека" : listSectionTab !== "all" ? "Все чаты" : undefined}
                onAction={
                  chats.length === 0
                    ? () => setShowContactsPage(true)
                    : listSectionTab !== "all"
                      ? () => setListSectionTab("all")
                      : undefined
                }
              />
            ) : (
              (() => {
                const chatsWithoutAi = chatsSortedByLastMessage.filter((c) => c.id !== AI_CHAT_ID);
                const bySection = groupChatsByDateSection(chatsWithoutAi);
                const rowExit = chatListReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.94, y: -12, filter: "blur(5px)" };
                const rowMotionTransition = chatListReducedMotion
                  ? { duration: DURATION_FAST_MS / 1000 }
                  : { duration: DURATION_EMPHASIS_MS / 1000, ease: EASING_OUT_BEZIER };
                return (
                  <AnimatePresence mode="popLayout" initial={false}>
                    {showAiOver ? (
                      <motion.p
                        key="ai-over-label"
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: DURATION_NORMAL_S * 0.6, ease: EASING_OUT_BEZIER }}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground px-1 py-1.5 sm:py-2"
                      >
                        <Pin className="w-3 h-3 text-indigo-500/80" aria-hidden />
                        Закреплён
                      </motion.p>
                    ) : null}
                    {showAiOver ? (
                      <motion.div
                        key={AI_CHAT_ID}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={rowExit}
                        transition={rowMotionTransition}
                      >
                        <ChatRow
                          chat={aiOverChat}
                          typingLabel={null}
                          voiceLabel={null}
                          onSelect={() => setLocation(`/chat/${AI_CHAT_ID}`)}
                          isAiChat
                        />
                      </motion.div>
                    ) : null}
                    {DATE_SECTION_ORDER.flatMap((sectionKey) => {
                      const sectionChats = bySection.get(sectionKey) ?? [];
                      if (sectionChats.length === 0) return [];
                      return [
                        <motion.p
                          key={`sec-h-${sectionKey}`}
                          layout
                          className="text-[11px] font-medium text-muted-foreground px-1 py-1.5 sm:py-2"
                        >
                          {DATE_SECTION_LABELS[sectionKey]}
                        </motion.p>,
                        ...sectionChats.map((chat) => (
                          <motion.div
                            key={chat.id}
                            layout
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={rowExit}
                            transition={rowMotionTransition}
                          >
                            <ChatRow
                              chat={chat}
                              typingLabel={typingByChatId[chat.id] ?? null}
                              voiceLabel={voiceRecordingByChatId[chat.id] ?? null}
                              onSelect={() => setLocation(`/chat/${encodeURIComponent(chat.id)}`)}
                              onLongPressMenu={() => setServiceMenuChat(chat)}
                            />
                          </motion.div>
                        )),
                      ];
                    })}
                  </AnimatePresence>
                );
              })()
            )}
          </div>
        </PullToRefresh>
      </div>

      <Drawer open={!!serviceMenuChat} onOpenChange={(o) => !o && setServiceMenuChat(null)}>
        <DrawerContent className="max-h-[min(92dvh,880px)] rounded-t-[1.25rem] border-border/35 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="space-y-2.5 p-5 pb-3 text-left sm:text-left">
            <DrawerTitle className="pr-8 text-left text-[1.0625rem] font-semibold leading-snug tracking-tight">
              {serviceMenuChat?.name ?? "Чат"}
            </DrawerTitle>
            <p className="text-left text-[13px] font-normal leading-relaxed text-muted-foreground">
              Чтобы снова открыть меню, удерживайте строку чата в списке около секунды, не сдвигая палец.
            </p>
          </DrawerHeader>
          <div className="space-y-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
            {serviceMenuChat ? (
              <>
                <div className="space-y-2">
                {serviceThreadMeta && serviceThreadMeta.hostUserId === user?.id ? (
                  <TapScaleButton
                    type="button"
                    className="flex h-auto min-h-[var(--uix-touch-min)] w-full items-center gap-3 rounded-2xl border border-border/50 bg-muted/20 px-4 py-3 text-left text-[15px] font-medium leading-snug text-foreground shadow-sm shadow-black/[0.04] dark:shadow-black/25 disabled:opacity-60"
                    subtle
                    disabled={serviceThreadLoading}
                    onClick={async () => {
                      if (!serviceMenuChat || !serviceThreadMeta) return;
                      const next = !serviceThreadMeta.localRepliesEnabled;
                      try {
                        await setServiceChatLocalReplies(serviceMenuChat.id, next);
                        setServiceThreadMeta({ ...serviceThreadMeta, localRepliesEnabled: next });
                        toast({ title: next ? "Обратная связь включена локально" : "Локальная обратная связь отключена" });
                      } catch (e) {
                        toast({
                          title: "Не удалось",
                          description: e instanceof Error ? e.message : "Ошибка",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <MessageCircle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                    {serviceThreadMeta.localRepliesEnabled ? "Отключить локальные ответы" : "Включить локальные ответы"}
                  </TapScaleButton>
                ) : null}
                <TapScaleButton
                  type="button"
                  className="flex h-auto min-h-[var(--uix-touch-min)] w-full items-center gap-3 rounded-2xl border border-border/50 bg-muted/20 px-4 py-3 text-left text-[15px] font-medium leading-snug text-foreground shadow-sm shadow-black/[0.04] dark:shadow-black/25"
                  subtle
                  onClick={async () => {
                    const c = serviceMenuChat;
                    try {
                      await patchChatMemberMe(c.id, { pinned: !c.pinnedAt });
                      refreshChatQueries();
                      setServiceMenuChat(null);
                      toast({ title: c.pinnedAt ? "Чат откреплён" : "Чат закреплён" });
                    } catch (e) {
                      toast({
                        title: "Не удалось",
                        description: e instanceof Error ? e.message : "Ошибка",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  {serviceMenuChat.pinnedAt ? (
                    <PinOff className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <Pin className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  {serviceMenuChat.pinnedAt ? "Открепить" : "Закрепить"}
                </TapScaleButton>
                <TapScaleButton
                  type="button"
                  className="flex h-auto min-h-[var(--uix-touch-min)] w-full items-center gap-3 rounded-2xl border border-border/50 bg-muted/20 px-4 py-3 text-left text-[15px] font-medium leading-snug text-foreground shadow-sm shadow-black/[0.04] dark:shadow-black/25"
                  subtle
                  onClick={async () => {
                    const c = serviceMenuChat;
                    try {
                      await patchChatMemberMe(c.id, { hidden: true });
                      refreshChatQueries();
                      setServiceMenuChat(null);
                      toast({
                        title: "Чат скрыт",
                        description: "Потяните список вниз для обновления — скрытые чаты появятся вверху списка.",
                      });
                    } catch (e) {
                      toast({
                        title: "Не удалось",
                        description: e instanceof Error ? e.message : "Ошибка",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <EyeOff className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  Скрыть из списка
                </TapScaleButton>
                </div>

                <div className="space-y-2.5 rounded-2xl border border-border/45 bg-muted/12 p-3.5">
                  <div className="space-y-1.5">
                    <p className="text-[13px] font-semibold leading-tight text-foreground">В папку</p>
                    {!hasCustomListSections ? (
                      <p className="text-[12px] leading-relaxed text-muted-foreground">
                        Вкладки папок вверху списка появятся, когда хотя бы один чат будет не в «Общих». Выберите
                        папку ниже.
                      </p>
                    ) : null}
                  </div>
                  <div
                    className="-mx-0.5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-0.5 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    role="radiogroup"
                    aria-label="Папка для чата"
                  >
                  {(
                    [
                      { id: "general", label: "Общие" },
                      { id: "friends", label: "Друзья" },
                      { id: "work", label: "Работа" },
                      { id: "promo", label: "Реклама" },
                      { id: "invitations", label: "Приглашения" },
                    ] as const
                  ).map((s) => {
                    const selected = (serviceMenuChat.listSection ?? "general") === s.id;
                    return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={async () => {
                        const c = serviceMenuChat;
                        try {
                          await patchChatMemberMe(c.id, { listSection: s.id });
                          refreshChatQueries();
                          setServiceMenuChat(null);
                          toast({ title: "Сохранено", description: `Полка: ${s.label}` });
                        } catch (e) {
                          toast({
                            title: "Не удалось",
                            description: e instanceof Error ? e.message : "Ошибка",
                            variant: "destructive",
                          });
                        }
                      }}
                      className={cn(
                        "snap-start shrink-0 rounded-full border px-3.5 py-2.5 text-[13px] font-medium leading-none transition-colors min-h-[var(--uix-touch-min)] sm:min-h-0 inline-flex items-center justify-center",
                        selected
                          ? "border-primary/50 bg-primary/14 text-foreground ring-1 ring-primary/25"
                          : "border-border/50 bg-background/40 text-foreground hover:bg-muted/35 active:bg-muted/45"
                      )}
                    >
                      {s.label}
                    </button>
                    );
                  })}
                  </div>
                </div>

                <div className="space-y-2 border-t border-border/40 pt-4">
                  <TapScaleButton
                    type="button"
                    className="flex h-auto min-h-[var(--uix-touch-min)] w-full items-center gap-3 rounded-2xl border border-border/50 bg-muted/20 px-4 py-3 text-left text-[15px] font-medium leading-snug text-foreground shadow-sm shadow-black/[0.04] dark:shadow-black/25"
                    subtle
                    onClick={() => {
                      openLeaveChatConfirm(serviceMenuChat);
                    }}
                  >
                    <Trash2 className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                    {serviceMenuChat.type === "group" ? "Покинуть группу" : "Удалить у меня"}
                  </TapScaleButton>
                  <TapScaleButton
                    type="button"
                    className={cn(
                      "flex h-auto min-h-[var(--uix-touch-min)] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] font-semibold leading-snug shadow-sm transition-colors",
                      "border-destructive/45 bg-destructive/20 text-destructive-foreground hover:bg-destructive/28 active:bg-destructive/34",
                      "disabled:pointer-events-none disabled:opacity-45"
                    )}
                    subtle
                    disabled={
                      serviceMenuChat.type === "group" && serviceMenuChat.myRole !== "admin"
                    }
                    onClick={() => openDeleteForAllConfirm(serviceMenuChat)}
                  >
                    <Trash2 className="h-5 w-5 shrink-0 opacity-95" aria-hidden />
                    {serviceMenuChat.type === "group" ? "Удалить группу у всех" : "Удалить у всех"}
                  </TapScaleButton>
                  {serviceMenuChat.type === "group" && serviceMenuChat.myRole !== "admin" ? (
                    <p className="text-[12px] leading-relaxed text-muted-foreground px-0.5">
                      Удалить для всех может только админ.
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog
        open={!!confirmLeaveChat}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteInProgress(null);
            setConfirmLeaveChat(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-1.75rem)] gap-0 border-0 bg-transparent p-3 shadow-none duration-300 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:zoom-out-[0.99] sm:max-w-[22rem] sm:rounded-[1.5rem] sm:p-4">
          <div className="overflow-hidden rounded-[1.35rem] border border-border/30 bg-gradient-to-b from-card via-card to-secondary/[0.12] shadow-[0_22px_50px_-18px_rgba(0,0,0,0.45)] backdrop-blur-xl dark:shadow-[0_22px_50px_-18px_rgba(0,0,0,0.65)]">
            <AlertDialogHeader className="space-y-3 px-5 pb-2 pt-6 text-center sm:text-left">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:mx-0">
                <Sparkles className="h-5 w-5 opacity-90" aria-hidden />
              </div>
              <AlertDialogTitle className="text-[1.05rem] font-semibold leading-snug tracking-tight sm:text-lg">
                {confirmLeaveChat?.type === "group" ? "Покинуть группу?" : "Убрать чат из списка?"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[13px] leading-relaxed text-muted-foreground">
                {confirmLeaveChat?.type === "group"
                  ? "Вы выйдите из группы. Историю можно будет восстановить, если вас снова пригласят."
                  : "Диалог скроется только у вас. Собеседник по-прежнему увидит переписку."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 border-t border-border/25 bg-muted/5 px-4 py-4 sm:flex-col sm:space-x-0">
              <AlertDialogCancel className="mt-0 h-11 w-full rounded-xl border-border/50 bg-background/80 sm:mt-0">
                Отмена
              </AlertDialogCancel>
              <Button
                type="button"
                className="h-11 w-full rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/15"
                disabled={deleteInProgress !== null}
                onClick={() => void runDeleteLeave()}
              >
                {deleteInProgress === "leave" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : confirmLeaveChat?.type === "group" ? (
                  "Покинуть"
                ) : (
                  "Убрать"
                )}
              </Button>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!confirmDeleteAllChat}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteInProgress(null);
            setConfirmDeleteAllChat(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-1.75rem)] gap-0 border-0 bg-transparent p-3 shadow-none duration-300 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:zoom-out-[0.99] sm:max-w-[22rem] sm:rounded-[1.5rem] sm:p-4">
          <div className="overflow-hidden rounded-[1.35rem] border border-destructive/20 bg-gradient-to-b from-card via-card to-destructive/[0.06] shadow-[0_22px_50px_-18px_rgba(0,0,0,0.45)] backdrop-blur-xl dark:shadow-[0_22px_50px_-18px_rgba(0,0,0,0.65)]">
            <AlertDialogHeader className="space-y-3 px-5 pb-2 pt-6 text-center sm:text-left">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive sm:mx-0">
                <Trash2 className="h-5 w-5 opacity-90" aria-hidden />
              </div>
              <AlertDialogTitle className="text-[1.05rem] font-semibold leading-snug tracking-tight sm:text-lg">
                Удалить для всех?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[13px] leading-relaxed text-muted-foreground">
                Переписка исчезнет у каждого участника. Вернуть будет нельзя.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 border-t border-border/25 bg-muted/5 px-4 py-4 sm:flex-col sm:space-x-0">
              <AlertDialogCancel className="mt-0 h-11 w-full rounded-xl border-border/50 bg-background/80 sm:mt-0">
                Отмена
              </AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                className="h-11 w-full rounded-xl shadow-md shadow-destructive/20"
                disabled={deleteInProgress !== null}
                onClick={() => void runDeleteForAll()}
              >
                {deleteInProgress === "forAll" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  "Удалить навсегда"
                )}
              </Button>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Модальное окно создания группового чата */}
      <Dialog
        open={showCreateGroupModal}
        onOpenChange={(open) => {
          setShowCreateGroupModal(open);
          if (!open) {
            setGroupName("");
            setSelectedMemberIds(new Set());
          }
        }}
      >
        <DialogContent className="max-h-[85vh] flex flex-col gap-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Новый групповой чат</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 min-h-0">
            <label className="text-sm font-medium">
              Название группы (необязательно)
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Например: Семья, Работа"
              className="w-full bg-secondary/50 border border-border rounded-xl py-2.5 px-3 text-[15px] focus:ring-2 focus:ring-primary/30 outline-none placeholder:text-muted-foreground"
            />
            <label className="text-sm font-medium">Участники</label>
            <div className="border border-border rounded-xl overflow-y-auto max-h-[240px] min-h-[120px] divide-y divide-border">
              {contactsList.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  Нет контактов. Добавьте контакты в разделе «Чаты» и начните диалог.
                </p>
              ) : (
                contactsList.map((contact) => {
                  const checked = selectedMemberIds.has(contact.id);
                  return (
                    <label
                      key={contact.id}
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary/50 transition-colors min-h-[var(--uix-touch-min)]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedMemberIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(contact.id)) next.delete(contact.id);
                            else next.add(contact.id);
                            return next;
                          });
                        }}
                        className="rounded border-input"
                      />
                      <UserAvatar
                        avatarUrl={contact.avatarUrl ?? undefined}
                        displayName={contactDisplayName(contact)}
                        seed={String(contact.id)}
                        size={40}
                        className="w-10 h-10"
                      />
                      <span className="font-medium text-[15px]">{contactDisplayName(contact)}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <TapScaleButton
              type="button"
              onClick={() => setShowCreateGroupModal(false)}
              className="min-h-[var(--uix-touch-min)] border border-input bg-background hover:bg-secondary"
            >
              Отмена
            </TapScaleButton>
            <TapScaleButton
              type="button"
              disabled={selectedMemberIds.size === 0 || groupCreateLoading}
              className="min-h-[var(--uix-touch-min)] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              onClick={async () => {
                if (selectedMemberIds.size === 0) return;
                setGroupCreateLoading(true);
                try {
                  const chat = await createGroupChat(groupName, Array.from(selectedMemberIds));
                  await queryClient.invalidateQueries({ queryKey: ["chats"] });
                  setShowCreateGroupModal(false);
                  setGroupName("");
                  setSelectedMemberIds(new Set());
                  setLocation(`/chat/${encodeURIComponent(chat.id)}`);
                } catch (err) {
                  toast({
                    title: "Не удалось создать группу",
                    description: err instanceof Error ? err.message : undefined,
                    variant: "destructive",
                  });
                } finally {
                  setGroupCreateLoading(false);
                }
              }}
            >
              {groupCreateLoading ? "Создание…" : "Создать"}
            </TapScaleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}