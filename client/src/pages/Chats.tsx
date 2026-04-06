import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  memo,
  useCallback,
  useMemo,
} from "react";
import { flushSync } from "react-dom";
import { useLocation, useSearch } from "wouter";
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
  Pin,
  PinOff,
  Users,
  BookUser,
  Loader2,
  EyeOff,
  Eye,
  Trash2,
  Briefcase,
  Megaphone,
  Inbox,
  Heart,
  LayoutList,
  Sparkles,
  MoreHorizontal,
  Ticket,
  Flag,
  Ban,
  Share2,
  SmilePlus,
  Settings2,
  Plus,
  MessageSquare,
  ExternalLink,
  ChevronDown,
  Folder,
  Bell,
  BellOff,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/GlobalSearch";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { useChatRealtime } from "@/features/chat/hooks/useChatRealtime";
import {
  onChatPendingUnread,
  onChatPendingUnreadClear,
  onChatRead,
  onComposerPulsePendingResolved,
  onComposerTransferPulse,
} from "@/features/chat/realtime-events";

import { API, apiFetch } from "@/lib/api-base";
import {
  addContact,
  listContactsWithProfiles,
  matchContactsFromPhones,
  type ContactPhoneMatchUser,
  type ContactUser,
} from "@/lib/users";
import { gatherPhoneStringsFromDevice, isWebContactPickerSupported } from "@/lib/contact-book-match";
import { isNative, triggerContextMenuOpenFeedback, triggerLightHaptic } from "@/lib/capacitor-native";
import { NewUserFeedOnboardingStrip } from "@/features/feed/components/NewUserFeedOnboardingStrip";
import { ListEmptyState, ErrorWithRetry } from "@/components/ui/empty";
import { LoadingProgress } from "@/components/ui/loading-progress";
import { BackgroundSyncBar } from "@/components/BackgroundSyncBar";
import { PageTitle } from "@/components/PageTitle";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Button } from "@/components/ui/button";
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
import { formatPushNewBadgeCount, usePushIncomingLastSeen } from "@/hooks/usePushIncomingLastSeen";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTouchEdgeNavigationEnabled, useTouchLeftEdgeSwipeRight } from "@/hooks/use-touch-edge-swipe";
import { startDm, createGroupChat, type Chat as SearchChatBrief } from "@/lib/search";
import { buildChatPath } from "@/lib/chat-route";
import {
  searchMessages,
  patchChatMemberMe,
  deleteChatForMe,
  deleteChatForEveryone,
  getServiceChatThread,
  setServiceChatLocalReplies,
  createChatListCustomFolder,
  deleteChatListCustomFolder,
  fetchChatListShelves,
  patchChatListBuiltinTabPref,
  patchChatListCustomFolder,
  type ServiceChatThreadMeta,
  type SearchMessageHit,
} from "@/lib/chat";
import { AI_CHAT_ID } from "@/features/chat/constants";
import type { ApiChat } from "@/features/chat";
import { prefetchChatMessagesTail } from "@/features/chat/prefetch-chat-messages-tail";
import { formatMessageContentPreview } from "@/features/chat/utils/message-content-preview";
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
import { playDeleteSound } from "@/lib/send-sound";
import { usePrefersReducedMotion } from "@/lib/motion";
import {
  DURATION_NORMAL_S,
  DURATION_FAST_MS,
  DURATION_EMPHASIS_MS,
  EASING_OUT_BEZIER,
} from "@/lib/motion";
import {
  createPushReply,
  fetchPushFeed,
  fetchPushOutbox,
  fetchPushReplies,
  removePushReaction,
  setPushReaction,
  type PushFeedItem,
  type PushReplyItem,
  hidePushFeedItem,
  updatePushAuthorHidden,
  updatePushAuthorSettings,
  unsubscribePushAuthor,
} from "@/lib/push-feed";
import { formatPostTime } from "@/lib/posts";
import { Switch } from "@/components/ui/switch";
import { addReaction, removeReaction, sharePostToUser } from "@/lib/posts";
import { setUserBlock, USER_BLOCK_PRESETS } from "@/lib/users";
import { submitContentReport } from "@/features/store-moderation/block-01-ugc";
import { isNavigatorShareCancelled } from "@/lib/navigator-share";
import { formatTimeLocal, formatDateShortLocal, parseServerTimestamp } from "@/lib/timezone";
import { getOfflineChatList, saveOfflineChatList } from "@/lib/chat-offline-store";
import { PostCaptionInlineParts } from "@/components/PostCaptionInlineParts";
import { USER_PROFILE_REACTION_EMOJIS } from "@/features/profile/user-profile/constants";
import { formatCompactCountRu } from "@/lib/number-format";
import { playLikeActionSound } from "@/lib/send-sound";
import { ChatRow } from "@/pages/chats/ChatRow";
import { parseExternalVideoUrl } from "@/lib/external-video";
import { extractFirstExternalVideoUrl } from "@/lib/post-external-video";
import {
  AttachPushViewRecording,
  CreateStandalonePushDrawer,
  OPEN_CREATE_STANDALONE_PUSH_EVENT,
} from "@/features/push";
import { PushFeedEmptyIncoming, PushFeedEmptyOutgoing } from "@/features/push/PushFeedEmptyStates";
import { PushFeedScopeSkeleton } from "@/features/push/PushFeedScopeSkeleton";
import { pushRetryToastAction } from "@/features/push/push-retry-toast-action";
import { usePushFeedAutoRefresh } from "@/features/push/usePushFeedAutoRefresh";

/** Превью Push: видео по расширению URL (в ленте нет MIME). */
function isLikelyPushVideoUrl(url: string): boolean {
  return /\.(mp4|webm|m4v|mov|ogg)(\?|#|$)/i.test(url);
}

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

/** Долгое удержание вкладки-полки: сервисное меню папки. */
const FOLDER_TAB_LONG_PRESS_MS = 1300;
const CHAT_SHELF_LONG_PRESS_MOVE_CANCEL_PX = 14;

const BUILTIN_SHELF_CHIPS = [
  { id: "friends" as const, defaultLabel: "Друзья", icon: Heart },
  { id: "work" as const, defaultLabel: "Работа", icon: Briefcase },
  { id: "promo" as const, defaultLabel: "Реклама", icon: Megaphone },
  { id: "invitations" as const, defaultLabel: "Приглашения", icon: Inbox },
] as const;

const CUSTOM_CHAT_SHELF_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function useChatShelfTabLongPress(onLongPress: () => void, durationMs: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const blockClickRef = useRef(false);
  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    originRef.current = null;
  }, []);
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      originRef.current = { x: e.clientX, y: e.clientY };
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        originRef.current = null;
        blockClickRef.current = true;
        window.setTimeout(() => {
          blockClickRef.current = false;
        }, 450);
        try {
          window.getSelection()?.removeAllRanges();
        } catch {
          /* ignore */
        }
        triggerContextMenuOpenFeedback();
        onLongPress();
      }, durationMs);
    },
    [onLongPress, durationMs],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const origin = originRef.current;
      if (!origin || !timerRef.current) return;
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      if (
        dx * dx + dy * dy >
        CHAT_SHELF_LONG_PRESS_MOVE_CANCEL_PX * CHAT_SHELF_LONG_PRESS_MOVE_CANCEL_PX
      ) {
        clear();
      }
    },
    [clear],
  );
  const onPointerUp = useCallback(() => clear(), [clear]);
  return {
    blockClickRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave: onPointerUp,
    onPointerCancel: onPointerUp,
  };
}

type ChatShelfTabButtonProps = {
  label: string;
  icon: typeof Heart;
  active: boolean;
  isPush: boolean;
  pushTabBadgeCount: number;
  chatListReducedMotion: boolean;
  onSelect: () => void;
  onLongPressMenu: () => void;
};

const ChatShelfTabButton = memo(function ChatShelfTabButton({
  label,
  icon: Icon,
  active,
  isPush,
  pushTabBadgeCount,
  chatListReducedMotion,
  onSelect,
  onLongPressMenu,
}: ChatShelfTabButtonProps) {
  const { blockClickRef, onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onPointerCancel } =
    useChatShelfTabLongPress(onLongPressMenu, FOLDER_TAB_LONG_PRESS_MS);
  const pushTabShimmer = isPush && active && !chatListReducedMotion;
  return (
    <TapScaleButton
      type="button"
      subtle
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      onClick={() => {
        if (blockClickRef.current) return;
        onSelect();
      }}
      aria-label={
        isPush && pushTabBadgeCount > 0 ? `Push, новых: ${pushTabBadgeCount}` : undefined
      }
      title={isPush && pushTabBadgeCount > 0 ? `Новых Push: ${pushTabBadgeCount}` : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0 min-h-[28px] shadow-none border relative max-w-[148px]",
        isPush && active
          ? "text-white border-rose-300/40 bg-gradient-to-r from-rose-500 via-pink-500 to-orange-400 shadow-[0_0_20px_rgba(244,114,182,0.35)] overflow-hidden"
          : isPush
            ? "text-rose-200 border-rose-300/25 bg-gradient-to-r from-rose-500/20 via-pink-500/20 to-orange-400/20 hover:from-rose-500/30 hover:to-orange-400/30 transition-colors duration-200"
            : active
              ? "bg-primary/12 border-primary/25 text-foreground transition-colors duration-200"
              : "bg-muted/25 border-border/30 text-muted-foreground hover:bg-muted/45 transition-colors duration-200",
      )}
    >
      {pushTabShimmer ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
        >
          <motion.span
            className="absolute inset-y-0 left-[-72%] w-[68%] skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/35 to-transparent"
            initial={{ x: "-20%" }}
            animate={{ x: "420%" }}
            transition={{
              duration: 2.8,
              ease: "linear",
              repeat: Infinity,
              repeatDelay: 1.1,
            }}
          />
        </motion.span>
      ) : null}
      <span className="relative z-[1] inline-flex min-w-0 items-center gap-1">
        <Icon className="w-3 h-3 opacity-80 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      {isPush && pushTabBadgeCount > 0 ? (
        <span
          className="absolute -right-0.5 -top-0.5 z-[2] flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-rose-500 px-[3px] text-[8.5px] font-bold leading-none text-white shadow-sm ring-[1.5px] ring-background"
          aria-hidden
        >
          {formatPushNewBadgeCount(pushTabBadgeCount)}
        </span>
      ) : null}
    </TapScaleButton>
  );
});

/** Короткая подпись «через сколько исчезнет из Push» — для едва заметной строки под именем. */
function formatPushExpiresSubtleLabel(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return "срок вышел";
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  if (totalMinutes < 60) {
    return `через ~${totalMinutes}\u00A0мин`;
  }
  const hoursCeil = Math.ceil(totalMinutes / 60);
  if (hoursCeil < 48) {
    return `через ~${hoursCeil}\u00A0ч`;
  }
  const daysCeil = Math.ceil(hoursCeil / 24);
  return `через ~${daysCeil}\u00A0дн`;
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
/** Подсветка строки лички после «пульса передачи» (синхрон с композером). */
const COMPOSER_TRANSFER_LIST_PULSE_MS = 3400;
const VOICE_RECORDING_PREVIEW_TTL_MS = 6000;

interface ChatsProps {
  embedded?: boolean;
}

export default function Chats({ embedded = false }: ChatsProps) {
  const [location, setLocation] = useLocation();
  const searchStr = useSearch();
  const isMobile = useIsMobile();
  const touchEdgeNavEnabled = useTouchEdgeNavigationEnabled();
  const queryClient = useQueryClient();
  const navigateToChat = useCallback(
    (chat: ApiChat | SearchChatBrief) => {
      prefetchChatMessagesTail(queryClient, chat.id);
      setLocation(buildChatPath(chat, chat.id));
    },
    [queryClient, setLocation],
  );
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showContactsPage, setShowContactsPage] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [groupCreateLoading, setGroupCreateLoading] = useState(false);

  /** Диплинк из медиа-студии и закладок: /?newGroup=1 */
  useEffect(() => {
    const pathOnly = location.split("?")[0] || "/";
    const raw = searchStr.startsWith("?") ? searchStr.slice(1) : searchStr;
    const params = new URLSearchParams(raw);
    const flag = params.get("newGroup");
    if (flag !== "1" && flag !== "true") return;
    setShowCreateGroupModal(true);
    params.delete("newGroup");
    const qs = params.toString();
    setLocation(qs ? `${pathOnly}?${qs}` : pathOnly, { replace: true } as { replace?: boolean });
  }, [location, searchStr, setLocation]);
  const [contactsSearchQuery, setContactsSearchQuery] = useState("");
  const [contactOpeningId, setContactOpeningId] = useState<string | null>(null);
  const [addressBookMatches, setAddressBookMatches] = useState<ContactPhoneMatchUser[]>([]);
  const [addressBookLoading, setAddressBookLoading] = useState(false);
  const [addressBookError, setAddressBookError] = useState<string | null>(null);
  const [typingByChatId, setTypingByChatId] = useState<Record<string, string | null>>({});
  const [voiceRecordingByChatId, setVoiceRecordingByChatId] = useState<Record<string, string | null>>({});
  const [composerTransferRowIds, setComposerTransferRowIds] = useState(() => new Set<string>());
  const composerRowPulseTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const bumpComposerListPulse = useCallback((cid: string) => {
    if (!cid) return;
    const prev = composerRowPulseTimersRef.current.get(cid);
    if (prev) clearTimeout(prev);
    setComposerTransferRowIds((s) => {
      const n = new Set(s);
      n.add(cid);
      return n;
    });
    const t = setTimeout(() => {
      composerRowPulseTimersRef.current.delete(cid);
      setComposerTransferRowIds((s) => {
        if (!s.has(cid)) return s;
        const n = new Set(s);
        n.delete(cid);
        return n;
      });
    }, COMPOSER_TRANSFER_LIST_PULSE_MS);
    composerRowPulseTimersRef.current.set(cid, t);
  }, []);

  const clearComposerListPulse = useCallback((cid: string) => {
    const prev = composerRowPulseTimersRef.current.get(cid);
    if (prev) clearTimeout(prev);
    composerRowPulseTimersRef.current.delete(cid);
    setComposerTransferRowIds((s) => {
      if (!s.has(cid)) return s;
      const n = new Set(s);
      n.delete(cid);
      return n;
    });
  }, []);

  const fetchComposerPulsePendingRows = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await apiFetch(`${API}/me/composer-pulse/pending`);
      if (!res.ok) return;
      const j = (await res.json()) as { pulses?: { chatId: string }[] };
      for (const p of j.pulses ?? []) {
        bumpComposerListPulse(p.chatId);
      }
    } catch {
      /* ignore */
    }
  }, [bumpComposerListPulse, user?.id]);

  const [messageSearchResults, setMessageSearchResults] = useState<SearchMessageHit[]>([]);
  const [messageSearchLoading, setMessageSearchLoading] = useState(false);
  const [pushScope, setPushScope] = useState<"incoming" | "outgoing">("incoming");
  const [createStandalonePushOpen, setCreateStandalonePushOpen] = useState(false);
  const [expandedPushPostIds, setExpandedPushPostIds] = useState<Set<string>>(() => new Set());
  const [pushShareTarget, setPushShareTarget] = useState<PushFeedItem | null>(null);
  const [pushRepliesTarget, setPushRepliesTarget] = useState<PushFeedItem | null>(null);
  const [pushRepliesVisibilityFilter, setPushRepliesVisibilityFilter] = useState<"all" | "public">("all");
  const [inlineReplyPushId, setInlineReplyPushId] = useState<string | null>(null);
  const [inlineReplyText, setInlineReplyText] = useState("");
  const [inlineReplyVisibility, setInlineReplyVisibility] = useState<"public" | "private">("public");
  const [pushReactionPickerPostId, setPushReactionPickerPostId] = useState<string | null>(null);
  /** Оптимистичное перекрытие до refetch; сервер отдаёт myReaction в ленте. */
  const [pushSessionMyReaction, setPushSessionMyReaction] = useState<Record<string, string>>({});
  const [pushScopeRefetchPending, setPushScopeRefetchPending] = useState(false);
  const inlineReplyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pushCardPointerDownRef = useRef<Record<string, { x: number; ts: number }>>({});
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const voiceTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const chatsListScrollRef = useRef<HTMLDivElement | null>(null);

  const {
    subscribeChat,
    subscribeTyping,
    subscribeVoiceRecording,
    notifyChatListUpdate,
    onRealtimeSocketConnected,
  } = useChatRealtime();

  /** Сразу после монтата подставляем последний снимок из IndexedDB (как холодный старт в мессенджерах). */
  useLayoutEffect(() => {
    let cancelled = false;
    void (async () => {
      const [all, hidden] = await Promise.all([getOfflineChatList("all"), getOfflineChatList("hidden")]);
      if (cancelled) return;
      if (all.length > 0) queryClient.setQueryData(["chats"], all);
      if (hidden.length > 0) queryClient.setQueryData(["chats", "hidden"], hidden);
    })();
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  const { data: chats = [], isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["chats"],
    queryFn: fetchChats,
    // «always» давало полный refetch при каждом возврате на вкладку Чаты + наслаивалось на WS — тяжело для WebView.
    staleTime: 15_000,
  });
  const chatsBackgroundSync = isFetching && !isLoading;
  const {
    data: pushFeed = [],
    isLoading: pushLoading,
    isFetching: pushFeedFetching,
    isError: pushError,
    refetch: refetchPush,
  } = useQuery({
    queryKey: ["push", "feed"],
    queryFn: () => fetchPushFeed(50, 0),
    staleTime: 15_000,
  });
  const {
    data: pushOutbox = [],
    isLoading: pushOutboxLoading,
    isFetching: pushOutboxFetching,
    isError: pushOutboxError,
    refetch: refetchPushOutbox,
  } = useQuery({
    queryKey: ["push", "outbox"],
    queryFn: () => fetchPushOutbox(50, 0),
    staleTime: 15_000,
  });
  const PUSH_REPLIES_PAGE_SIZE = 25;
  const {
    data: pushRepliesInfinite,
    isLoading: pushRepliesLoading,
    isError: pushRepliesError,
    isFetchingNextPage: pushRepliesFetchingNext,
    fetchNextPage: fetchNextPushReplies,
    hasNextPage: pushRepliesHasNext,
    refetch: refetchPushRepliesPages,
  } = useInfiniteQuery({
    queryKey: ["push", "replies", pushRepliesTarget?.id ?? "", pushRepliesVisibilityFilter],
    queryFn: ({ pageParam }) =>
      fetchPushReplies(pushRepliesTarget!.id, {
        limit: PUSH_REPLIES_PAGE_SIZE,
        offset: pageParam,
        visibilityFilter: pushRepliesVisibilityFilter === "public" ? "public" : "all",
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    enabled: Boolean(pushRepliesTarget?.id),
    staleTime: 0,
  });
  const pushRepliesFlat = pushRepliesInfinite?.pages.flatMap((p) => p.items) ?? [];
  const pushRepliesTotal = pushRepliesInfinite?.pages[0]?.total ?? 0;
  const patchPushAuthorMutation = useMutation({
    mutationFn: ({ authorId, enabled }: { authorId: string; enabled: boolean }) =>
      updatePushAuthorSettings(authorId, enabled),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["push", "feed"] });
    },
    onError: (e) => {
      toast({
        title: "Не удалось обновить уведомления автора",
        description: e instanceof Error ? e.message : "Повторите позже",
        variant: "destructive",
      });
    },
  });
  const hidePushItemMutation = useMutation({
    mutationFn: (pushPostId: string) => hidePushFeedItem(pushPostId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["push", "feed"] });
    },
    onError: (e) => {
      toast({
        title: "Не удалось удалить Push",
        description: e instanceof Error ? e.message : "Повторите позже",
        variant: "destructive",
      });
    },
  });
  const hidePushAuthorMutation = useMutation({
    mutationFn: ({ authorId, hidden }: { authorId: string; hidden: boolean }) =>
      updatePushAuthorHidden(authorId, hidden),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["push", "feed"] });
    },
    onError: (e) => {
      toast({
        title: "Не удалось скрыть Push автора",
        description: e instanceof Error ? e.message : "Повторите позже",
        variant: "destructive",
      });
    },
  });
  const unsubscribePushAuthorMutation = useMutation({
    mutationFn: (authorId: string) => unsubscribePushAuthor(authorId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["push", "feed"] });
      toast({ title: "Вы отписались от Push автора" });
    },
    onError: (e) => {
      toast({
        title: "Не удалось отписаться",
        description: e instanceof Error ? e.message : "Повторите позже",
        variant: "destructive",
      });
    },
  });
  const pushReactionMutation = useMutation({
    mutationFn: ({ pushPostId, emoji }: { pushPostId: string; emoji: string }) => setPushReaction(pushPostId, emoji),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["push", "feed"] });
      void queryClient.invalidateQueries({ queryKey: ["push", "outbox"] });
    },
  });
  const removePushReactionMutation = useMutation({
    mutationFn: (pushPostId: string) => removePushReaction(pushPostId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["push", "feed"] });
      void queryClient.invalidateQueries({ queryKey: ["push", "outbox"] });
    },
  });
  const createPushReplyMutation = useMutation({
    mutationFn: (payload: { pushPostId: string; text: string; visibility: "public" | "private" }) =>
      createPushReply(payload.pushPostId, payload.text, payload.visibility),
    onSuccess: (_data, variables) => {
      setInlineReplyText("");
      setInlineReplyPushId((prev) => (prev === variables.pushPostId ? null : prev));
      void queryClient.invalidateQueries({ queryKey: ["push", "feed"] });
      void queryClient.invalidateQueries({ queryKey: ["push", "outbox"] });
      void queryClient.invalidateQueries({ queryKey: ["push", "replies", variables.pushPostId] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "Ответ на Push отправлен" });
    },
    onError: (e, variables) => {
      toast({
        title: e instanceof Error ? e.message : "Не удалось отправить ответ",
        variant: "destructive",
        action: pushRetryToastAction(() => {
          createPushReplyMutation.mutate(variables);
        }),
      });
    },
  });

  /** Пока refetch /chats не подтвердил unread, показываем индикатор по событию входящего из WS (слушатель в AppLayout). */
  const [pendingUnreadChatIds, setPendingUnreadChatIds] = useState(() => new Set<string>());

  useEffect(() => {
    return onChatPendingUnread(({ chatId }) => {
      setPendingUnreadChatIds((prev) => {
        if (prev.has(chatId)) return prev;
        const next = new Set(prev);
        next.add(chatId);
        return next;
      });
    });
  }, []);

  useEffect(() => {
    return onChatPendingUnreadClear(({ chatId }) => {
      setPendingUnreadChatIds((prev) => {
        if (!prev.has(chatId)) return prev;
        const next = new Set(prev);
        next.delete(chatId);
        return next;
      });
    });
  }, []);

  useEffect(() => {
    return onChatRead((detail) => {
      if (!detail.readerId || detail.readerId !== user?.id) return;
      setPendingUnreadChatIds((prev) => {
        if (!prev.has(detail.chatId)) return prev;
        const next = new Set(prev);
        next.delete(detail.chatId);
        return next;
      });
    });
  }, [user?.id]);

  useEffect(() => {
    return onComposerTransferPulse((d) => {
      if (d.userId === user?.id) return;
      bumpComposerListPulse(d.chatId);
    });
  }, [bumpComposerListPulse, user?.id]);

  useEffect(() => {
    return onComposerPulsePendingResolved(({ chatId }) => {
      clearComposerListPulse(chatId);
    });
  }, [clearComposerListPulse]);

  useEffect(() => {
    void fetchComposerPulsePendingRows();
  }, [fetchComposerPulsePendingRows]);

  useEffect(() => {
    return onRealtimeSocketConnected(() => {
      void fetchComposerPulsePendingRows();
    });
  }, [fetchComposerPulsePendingRows, onRealtimeSocketConnected]);

  useEffect(() => {
    if (chats.length === 0) return;
    setPendingUnreadChatIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      let changed = false;
      for (const chat of chats) {
        if (next.has(chat.id) && chatHasUnread(chat)) {
          next.delete(chat.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [chats]);

  const [listSectionTab, setListSectionTab] = useState<string>("all");

  const { data: shelfData } = useQuery({
    queryKey: ["chat-list-shelves"],
    queryFn: fetchChatListShelves,
    staleTime: 60_000,
    retry: 1,
  });
  const builtinTabPrefs = shelfData?.builtinTabPrefs ?? {};
  const customShelfFolders = shelfData?.customFolders ?? [];

  const shelfTabRow = useMemo(() => {
    const rows: {
      tabId: string;
      label: string;
      icon: typeof Heart;
      kind: "synthetic" | "builtin" | "custom";
    }[] = [
      { tabId: "push", label: "Push", icon: Sparkles, kind: "synthetic" },
      { tabId: "all", label: "Все", icon: LayoutList, kind: "synthetic" },
    ];
    for (const b of BUILTIN_SHELF_CHIPS) {
      const pref = builtinTabPrefs[b.id];
      const label = pref?.labelOverride?.trim() ? pref.labelOverride.trim() : b.defaultLabel;
      rows.push({ tabId: b.id, label, icon: b.icon, kind: "builtin" });
    }
    for (const c of customShelfFolders) {
      rows.push({ tabId: c.id, label: c.name, icon: Folder, kind: "custom" });
    }
    return rows;
  }, [builtinTabPrefs, customShelfFolders]);

  useEffect(() => {
    if (!CUSTOM_CHAT_SHELF_ID_RE.test(listSectionTab)) return;
    if (customShelfFolders.some((f) => f.id === listSectionTab)) return;
    setListSectionTab("all");
  }, [customShelfFolders, listSectionTab]);

  const [folderShelfMenuTab, setFolderShelfMenuTab] = useState<string | null>(null);
  const [addShelfFolderOpen, setAddShelfFolderOpen] = useState(false);
  const [newShelfFolderName, setNewShelfFolderName] = useState("");
  const [shelfCreateLoading, setShelfCreateLoading] = useState(false);
  const [renameShelfOpen, setRenameShelfOpen] = useState(false);
  const [renameShelfValue, setRenameShelfValue] = useState("");
  const [renameShelfTarget, setRenameShelfTarget] = useState<
    null | { kind: "builtin"; tabId: string } | { kind: "custom"; id: string }
  >(null);
  const [confirmDeleteShelfId, setConfirmDeleteShelfId] = useState<string | null>(null);
  const [deleteShelfLoading, setDeleteShelfLoading] = useState(false);

  useEffect(() => {
    const onOpen = () => {
      setListSectionTab("push");
      setPushScope("outgoing");
      setCreateStandalonePushOpen(true);
    };
    window.addEventListener(OPEN_CREATE_STANDALONE_PUSH_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CREATE_STANDALONE_PUSH_EVENT, onOpen);
  }, []);

  const { tabBadgeCount: pushTabBadgeCount } = usePushIncomingLastSeen({
    userId: user?.id,
    listSectionTab,
    incomingFeed: pushFeed,
  });

  const activePushFeed = pushScope === "incoming" ? pushFeed : pushOutbox;
  const activePushLoading = pushScope === "incoming" ? pushLoading : pushOutboxLoading;
  const activePushError = pushScope === "incoming" ? pushError : pushOutboxError;
  const activePushFetching = pushScope === "incoming" ? pushFeedFetching : pushOutboxFetching;
  const showPushScopeSkeleton =
    pushScopeRefetchPending && activePushFetching && !activePushLoading;

  useEffect(() => {
    if (!pushScopeRefetchPending) return;
    if (!activePushFetching) setPushScopeRefetchPending(false);
  }, [pushScopeRefetchPending, activePushFetching]);

  usePushFeedAutoRefresh(listSectionTab === "push", () => {
    void refetchPush();
    void refetchPushOutbox();
  });
  const selectedChatRouteMatch = location.match(/^\/chat\/([^/?#]+)/);
  const selectedChatId = selectedChatRouteMatch?.[1] ? decodeURIComponent(selectedChatRouteMatch[1]) : null;
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

  const prevPushRepliesOpenRef = useRef(false);
  useEffect(() => {
    const open = pushRepliesTarget !== null;
    if (open && !prevPushRepliesOpenRef.current) {
      setPushRepliesVisibilityFilter("all");
    }
    prevPushRepliesOpenRef.current = open;
  }, [pushRepliesTarget]);

  useEffect(() => {
    if (!inlineReplyPushId || chatListReducedMotion) return;
    const id = requestAnimationFrame(() => inlineReplyTextareaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [inlineReplyPushId, chatListReducedMotion]);

  const { data: hiddenChats = [], isLoading: hiddenLoading, refetch: refetchHidden } = useQuery({
    queryKey: ["chats", "hidden"],
    queryFn: fetchHiddenChats,
    staleTime: 60_000,
  });

  useEffect(() => {
    const onOnline = () => {
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      void queryClient.invalidateQueries({ queryKey: ["chats", "hidden"] });
      void queryClient.invalidateQueries({ queryKey: ["push", "feed"] });
      void queryClient.invalidateQueries({ queryKey: ["chat-list-shelves"] });
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [queryClient]);

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
          if (typingTimeoutsRef.current[chatId]) {
            clearTimeout(typingTimeoutsRef.current[chatId]);
            delete typingTimeoutsRef.current[chatId];
          }
          setTypingByChatId((prev) => {
            if (prev[chatId] == null) return prev;
            const next = { ...prev };
            delete next[chatId];
            return next;
          });
          if (voiceTimeoutsRef.current[chatId]) {
            clearTimeout(voiceTimeoutsRef.current[chatId]);
            delete voiceTimeoutsRef.current[chatId];
          }
          setVoiceRecordingByChatId((prev) => {
            if (prev[chatId] == null) return prev;
            const next = { ...prev };
            delete next[chatId];
            return next;
          });
          notifyChatListUpdate();
        })
      );
      unsubs.push(
        subscribeTyping(chatId, (userId, displayName, active) => {
          if (userId === user?.id) return;
          if (active === false) {
            if (typingTimeoutsRef.current[chatId]) {
              clearTimeout(typingTimeoutsRef.current[chatId]);
              delete typingTimeoutsRef.current[chatId];
            }
            flushSync(() =>
              setTypingByChatId((prev) => {
                if (prev[chatId] == null) return prev;
                const next = { ...prev };
                delete next[chatId];
                return next;
              }),
            );
            return;
          }
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
    enabled: showContactsPage || showCreateGroupModal || Boolean(pushShareTarget),
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

  const shelfFolderAssignOptions = useMemo(() => {
    return [
      { id: "general" as const, label: "Общие" },
      ...BUILTIN_SHELF_CHIPS.map((b) => ({
        id: b.id,
        label: builtinTabPrefs[b.id]?.labelOverride?.trim() || b.defaultLabel,
      })),
      ...customShelfFolders.map((c) => ({ id: c.id, label: c.name })),
    ];
  }, [builtinTabPrefs, customShelfFolders]);

  const folderShelfMenuMeta = useMemo(() => {
    const tab = folderShelfMenuTab;
    if (!tab) return null;
    if (tab === "push") return { kind: "synthetic" as const, synthetic: "push" as const };
    if (tab === "all") return { kind: "synthetic" as const, synthetic: "all" as const };
    const builtin = BUILTIN_SHELF_CHIPS.find((b) => b.id === tab);
    if (builtin) {
      const title = builtinTabPrefs[tab]?.labelOverride?.trim() || builtin.defaultLabel;
      const pushMuted = builtinTabPrefs[tab]?.pushMuted === true;
      return { kind: "builtin" as const, tabId: tab, title, pushMuted };
    }
    const c = customShelfFolders.find((f) => f.id === tab);
    if (c) {
      return { kind: "custom" as const, id: c.id, title: c.name, pushMuted: c.pushMuted === true };
    }
    return { kind: "unknown" as const };
  }, [folderShelfMenuTab, builtinTabPrefs, customShelfFolders]);

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
  }, [queryClient]);

  const unhideChat = useCallback(
    async (chatId: string) => {
      try {
        await patchChatMemberMe(chatId, { hidden: false });
        refreshChatQueries();
        await refetchHidden();
        toast({ title: "Чат снова в основном списке" });
      } catch (e) {
        toast({
          title: "Не удалось вернуть чат",
          description: e instanceof Error ? e.message : "Повторите позже",
          variant: "destructive",
        });
      }
    },
    [refreshChatQueries, refetchHidden, toast],
  );

  const serviceMenuChatIsHidden = useMemo(
    () => !!serviceMenuChat && hiddenChats.some((h) => h.id === serviceMenuChat.id),
    [serviceMenuChat, hiddenChats],
  );

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

  const goToProfileFromChats = useCallback(() => {
    void triggerLightHaptic();
    setLocation("/profile/me");
  }, [setLocation]);

  const handlePushCardRemove = useCallback(
    (pushPostId: string) => {
      if (hidePushItemMutation.isPending) return;
      hidePushItemMutation.mutate(pushPostId);
    },
    [hidePushItemMutation],
  );

  const handlePushCardPointerDown = useCallback((pushPostId: string, clientX: number) => {
    pushCardPointerDownRef.current[pushPostId] = { x: clientX, ts: Date.now() };
  }, []);

  const handlePushCardPointerUp = useCallback(
    (pushPostId: string, clientX: number) => {
      const start = pushCardPointerDownRef.current[pushPostId];
      if (!start) return;
      delete pushCardPointerDownRef.current[pushPostId];
      const deltaX = clientX - start.x;
      const holdMs = Date.now() - start.ts;
      if (deltaX >= 88 || holdMs >= 650) {
        handlePushCardRemove(pushPostId);
      }
    },
    [handlePushCardRemove],
  );

  const handlePushReact = useCallback(
    async (pushPostId: string, postId: string, emoji: string) => {
      const run = async () => {
        await Promise.all([pushReactionMutation.mutateAsync({ pushPostId, emoji }), addReaction(postId, emoji)]);
        setPushSessionMyReaction((prev) => ({ ...prev, [pushPostId]: emoji }));
        setPushReactionPickerPostId((prev) => (prev === pushPostId ? null : prev));
        toast({ title: `Реакция ${emoji} отправлена` });
      };
      try {
        await run();
      } catch (e) {
        toast({
          title: e instanceof Error ? e.message : "Не удалось отправить реакцию",
          variant: "destructive",
          action: pushRetryToastAction(() => {
            void run().catch((err) =>
              toast({
                title: err instanceof Error ? err.message : "Не удалось отправить реакцию",
                variant: "destructive",
              }),
            );
          }),
        });
      }
    },
    [pushReactionMutation, toast],
  );

  const handlePushRemoveReact = useCallback(
    async (pushPostId: string, postId: string) => {
      const run = async () => {
        await Promise.all([removePushReactionMutation.mutateAsync(pushPostId), removeReaction(postId)]);
        setPushSessionMyReaction((prev) => {
          const next = { ...prev };
          delete next[pushPostId];
          return next;
        });
      };
      try {
        await run();
      } catch (e) {
        toast({
          title: e instanceof Error ? e.message : "Не удалось убрать реакцию",
          variant: "destructive",
          action: pushRetryToastAction(() => {
            void run().catch((err) =>
              toast({
                title: err instanceof Error ? err.message : "Не удалось убрать реакцию",
                variant: "destructive",
              }),
            );
          }),
        });
      }
    },
    [removePushReactionMutation, toast],
  );

  const handleInlinePushReplySubmit = useCallback(() => {
    if (!inlineReplyPushId) return;
    const trimmed = inlineReplyText.trim();
    if (!trimmed) {
      toast({ title: "Введите текст ответа", variant: "destructive" });
      return;
    }
    createPushReplyMutation.mutate({
      pushPostId: inlineReplyPushId,
      text: trimmed,
      visibility: inlineReplyVisibility,
    });
  }, [createPushReplyMutation, inlineReplyPushId, inlineReplyText, inlineReplyVisibility, toast]);

  const toggleInlineReplyForPush = useCallback((pushPostId: string) => {
    setInlineReplyPushId((prev) => {
      if (prev === pushPostId) {
        setInlineReplyText("");
        return null;
      }
      setInlineReplyText("");
      setInlineReplyVisibility("public");
      return pushPostId;
    });
  }, []);

  const handlePushShareNative = useCallback(
    async (item: PushFeedItem) => {
      const postSeg = (item.postLinkCode || item.postId).trim();
      const authorSeg = item.postAuthorPublicId != null ? String(item.postAuthorPublicId) : encodeURIComponent(item.postAuthorId);
      const url = `${window.location.origin}/u/${encodeURIComponent(authorSeg)}/p/${encodeURIComponent(postSeg)}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: `${item.author.displayName}: Push`, text: item.text.slice(0, 160), url });
          return;
        }
        await navigator.clipboard.writeText(url);
        toast({ title: "Ссылка на Push скопирована" });
      } catch (e) {
        if (isNavigatorShareCancelled(e)) return;
        toast({ title: "Не удалось поделиться", variant: "destructive" });
      }
    },
    [toast],
  );

  const handlePushReport = useCallback(
    async (item: PushFeedItem) => {
      try {
        await submitContentReport({
          targetType: "post",
          targetId: item.postId,
          contextPostId: item.postId,
          reasonCode: "spam",
          reason: "Жалоба из Push-ленты",
        });
        toast({ title: "Жалоба отправлена" });
      } catch (e) {
        toast({ title: e instanceof Error ? e.message : "Не удалось отправить жалобу", variant: "destructive" });
      }
    },
    [toast],
  );

  const handlePushBlockAuthor = useCallback(
    async (authorId: string) => {
      try {
        await setUserBlock(authorId, USER_BLOCK_PRESETS.full);
        hidePushAuthorMutation.mutate({ authorId, hidden: true });
        toast({ title: "Пользователь заблокирован" });
      } catch (e) {
        toast({ title: e instanceof Error ? e.message : "Не удалось заблокировать", variant: "destructive" });
      }
    },
    [hidePushAuthorMutation, toast],
  );

  const handleForwardPushToUser = useCallback(
    async (item: PushFeedItem, toUserId: string) => {
      try {
        const result = await sharePostToUser(item.postId, toUserId);
        setPushShareTarget(null);
        toast({ title: "Push переслан в сообщение" });
        prefetchChatMessagesTail(queryClient, result.chatId);
        setLocation(`/chat/${encodeURIComponent(result.chatId)}`);
      } catch (e) {
        toast({ title: e instanceof Error ? e.message : "Не удалось переслать Push", variant: "destructive" });
      }
    },
    [queryClient, setLocation, toast],
  );

  const chatsEdgeSwipeBlocked = useMemo(
    () =>
      showContactsPage ||
      showCreateGroupModal ||
      serviceMenuChat !== null ||
      confirmDeleteAllChat !== null ||
      confirmLeaveChat !== null ||
      deleteInProgress !== null ||
      hiddenPeekOpen ||
      searchQuery.trim().length > 0,
    [
      showContactsPage,
      showCreateGroupModal,
      serviceMenuChat,
      confirmDeleteAllChat,
      confirmLeaveChat,
      deleteInProgress,
      hiddenPeekOpen,
      searchQuery,
    ],
  );

  useTouchLeftEdgeSwipeRight({
    enabled: touchEdgeNavEnabled && location === "/",
    blocked: chatsEdgeSwipeBlocked,
    onNavigate: goToProfileFromChats,
  });

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
                      <TapScaleButton
                        type="button"
                        subtle
                        onClick={() => void syncAddressBookMatches()}
                        className="min-h-[var(--uix-touch-min)] px-1 text-primary underline underline-offset-2 bg-transparent border-0 shadow-none"
                      >
                        Повторить
                      </TapScaleButton>
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
                          className="flex items-center justify-between p-3 hover:bg-secondary/50 rounded-2xl transition-colors group"
                        >
                          <TapScaleDiv
                            subtle
                            className="flex flex-1 min-w-0 items-center gap-3 text-left rounded-xl -m-1 p-1 pr-2"
                            onClick={async () => {
                              if (contactOpeningId) return;
                              setContactOpeningId(m.id);
                              try {
                                const chat = await startDm(m.id);
                                navigateToChat(chat);
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
                              pointerEventsNone
                            />
                            <div className="min-w-0">
                              <h3 className="font-semibold text-[16px] truncate">{contactDisplayName(m)}</h3>
                              <p className="text-sm text-muted-foreground">
                                {m.isInMyContacts ? "Уже в контактах" : "В Ping"}
                              </p>
                            </div>
                          </TapScaleDiv>
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
                            <TapScaleButton
                              type="button"
                              subtle
                              className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 border-0 bg-transparent shadow-none"
                              aria-label={`Написать ${contactDisplayName(m)}`}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (contactOpeningId) return;
                                setContactOpeningId(m.id);
                                try {
                                  const chat = await startDm(m.id);
                                  navigateToChat(chat);
                                  setShowContactsPage(false);
                                } finally {
                                  setContactOpeningId(null);
                                }
                              }}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </TapScaleButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <TapScaleDiv
                  subtle
                  className="flex items-center gap-3 p-3 ml-1 mb-2 hover:bg-secondary/50 rounded-2xl cursor-pointer transition-colors"
                  onClick={() => {
                    setShowContactsPage(false);
                    setContactsSearchQuery("");
                    setLocation("/help/invite-friends");
                  }}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Ticket className="w-5 h-5 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="font-medium text-[15px] text-primary">Пригласить друга</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      Регистрация по коду: до трёх приглашений или заявка на ещё — как в настройках
                    </p>
                  </div>
                </TapScaleDiv>

                <TapScaleDiv
                  subtle
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
                </TapScaleDiv>
              </>
            )}

            {Object.keys(groupedContacts).length === 0 ? (
              <div className="py-7">
                <ListEmptyState
                  icon={UserPlus}
                  title="Пока нет контактов"
                  description="Найдите пользователя через поиск в разделе «Чаты» и начните диалог."
                />
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
                        <TapScaleDiv
                          key={`contact-${contact.id}`}
                          subtle
                          className="flex items-center justify-between p-3 hover:bg-secondary/50 rounded-2xl cursor-pointer transition-colors group min-w-0"
                          onClick={async () => {
                            if (contactOpeningId) return;
                            setContactOpeningId(contact.id);
                            try {
                              const chat = await startDm(contact.id);
                              navigateToChat(chat);
                              setShowContactsPage(false);
                            } finally {
                              setContactOpeningId(null);
                            }
                          }}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <UserAvatar
                              avatarUrl={contact.avatarUrl ?? undefined}
                              displayName={contactDisplayName(contact)}
                              seed={String(contact.id)}
                              size={48}
                              className="w-12 h-12 shrink-0"
                              pointerEventsNone
                            />
                            <div className="min-w-0">
                              <h3 className="font-semibold text-[16px] truncate">{contactDisplayName(contact)}</h3>
                              <p className="text-sm text-muted-foreground">В контактах</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TapScaleButton
                              type="button"
                              subtle
                              className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 border-0 bg-transparent shadow-none"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (contactOpeningId) return;
                                setContactOpeningId(contact.id);
                                try {
                                  const chat = await startDm(contact.id);
                                  navigateToChat(chat);
                                  setShowContactsPage(false);
                                } finally {
                                  setContactOpeningId(null);
                                }
                              }}
                              aria-label={`Написать ${contactDisplayName(contact)}`}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </TapScaleButton>
                            <TapScaleButton
                              type="button"
                              subtle
                              className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 border-0 bg-transparent shadow-none"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (contactOpeningId) return;
                                setContactOpeningId(contact.id);
                                try {
                                  const chat = await startDm(contact.id);
                                  navigateToChat(chat);
                                  setShowContactsPage(false);
                                } finally {
                                  setContactOpeningId(null);
                                }
                              }}
                              aria-label={`Позвонить ${contactDisplayName(contact)}`}
                            >
                              <Phone className="w-4 h-4" />
                            </TapScaleButton>
                            <TapScaleButton
                              type="button"
                              subtle
                              className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 border-0 bg-transparent shadow-none"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (contactOpeningId) return;
                                setContactOpeningId(contact.id);
                                try {
                                  const chat = await startDm(contact.id);
                                  navigateToChat(chat);
                                  setShowContactsPage(false);
                                } finally {
                                  setContactOpeningId(null);
                                }
                              }}
                              aria-label={`Видеозвонок ${contactDisplayName(contact)}`}
                            >
                              <Video className="w-4 h-4" />
                            </TapScaleButton>
                          </div>
                        </TapScaleDiv>
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
        <div
          className={cn(
            "flex h-full w-full max-w-full min-w-0 overflow-x-hidden animate-in fade-in duration-150",
            embedded && "border-l border-border/40 bg-card/10",
          )}
          data-pull-refresh-scope
        >
      {!embedded ? <PageTitle title="Чаты" /> : null}
      <div className="w-full max-w-full min-w-0 flex flex-col h-full bg-background relative">
        
        {/* Header — компактно, как в TG: ~5px от краёв */}
        <div
          className={cn(
            "uix-content-x relative z-50 isolate pb-2 sm:pb-2.5 glass sticky top-0 border-b border-border/50",
            embedded ? "pt-2.5 sm:pt-3" : "pt-safe sm:pt-3.5",
          )}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2">
            <span className="uix-text-title tracking-tight">
              Чаты{embedded && chats.length > 0 ? ` (${chats.length})` : ""}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] shrink-0 rounded-2xl border-0 shadow-none hover:bg-secondary/80"
                  title="Новый чат или группа"
                  aria-label="Новый чат или групповой чат"
                >
                  <Edit className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[100] min-w-[180px]">
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

            <div className="min-w-0">
              <GlobalSearch
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Поиск по номеру, ID или имени..."
                showBusinessToggle={false}
                className="[&_input]:h-11 [&_input]:rounded-2xl [&_input]:bg-card/80 [&_input]:text-[15px] [&_input]:shadow-[inset_0_0_0_1px_hsl(var(--border)/0.45)] [&_input]:focus:ring-2 [&_input]:focus:ring-primary/25"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] shrink-0 rounded-2xl border-0 shadow-none hover:bg-secondary/80"
              title="Контакты"
              aria-label="Контакты"
              onClick={() => {
                triggerLightHaptic();
                setShowContactsPage(true);
              }}
            >
              <UserPlus className="h-5 w-5" />
            </Button>

          </div>
          <BackgroundSyncBar
            active={chatsBackgroundSync}
            className="absolute bottom-0 left-0 right-0 rounded-none"
            label="Обновление списка чатов"
          />
        </div>

        {/* List Content — чаты в 5px от краёв, как в Telegram */}
        <PullToRefresh
          onRefresh={async () => {
            await Promise.all([refetch(), refetchHidden(), refetchPush(), refetchPushOutbox()]);
          }}
          onPastThresholdRelease={revealHiddenPeekIfAny}
          className="min-h-0"
          enableHoldRefresh={false}
          scrollRef={chatsListScrollRef}
        >
          <div
            className={cn(
              "uix-content-x py-2 sm:py-2.5 space-y-1",
              embedded
                ? "pb-3"
                : "pb-[calc(var(--uix-nav-bottom)+var(--uix-space-3))]",
            )}
          >
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
                        В основном списке не показываются, без счётчика непрочитанного. Нажмите строку — открыть чат;
                        три точки — вернуть в список; удерживайте строку — полное меню.
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
                      currentUserId={user?.id}
                      isSelected={selectedChatId === h.id}
                      typingLabel={null}
                      voiceLabel={null}
                      suppressUnreadVisual
                      composerTransferPulse={h.type === "dm" && composerTransferRowIds.has(h.id)}
                      onSelect={() => navigateToChat(h)}
                      onLongPressMenu={() => setServiceMenuChat(h)}
                      trailingAction={
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <TapScaleButton
                              type="button"
                              subtle
                              className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground border-0 bg-transparent shadow-none"
                              aria-label="Меню скрытого чата"
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-5 w-5" aria-hidden />
                            </TapScaleButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[220px]">
                            <DropdownMenuItem
                              onClick={() => {
                                void unhideChat(h.id);
                              }}
                            >
                              <Eye className="h-4 w-4" aria-hidden />
                              Вернуть в основной список
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      }
                    />
                  ))}
                </div>
              </motion.div>
            ) : null}
            {searchLower === "" && (
              <div className="flex gap-1 overflow-x-auto pb-2 -mx-0.5 px-0.5 scrollbar-none items-center">
                {shelfTabRow.map((t) => (
                  <ChatShelfTabButton
                    key={t.tabId}
                    label={t.label}
                    icon={t.icon}
                    active={listSectionTab === t.tabId}
                    isPush={t.tabId === "push"}
                    pushTabBadgeCount={pushTabBadgeCount}
                    chatListReducedMotion={chatListReducedMotion}
                    onSelect={() => setListSectionTab(t.tabId)}
                    onLongPressMenu={() => setFolderShelfMenuTab(t.tabId)}
                  />
                ))}
                <TapScaleButton
                  type="button"
                  subtle
                  haptic
                  aria-label="Новая папка"
                  title={customShelfFolders.length >= 30 ? "Не более 30 своих папок" : "Добавить папку"}
                  disabled={customShelfFolders.length >= 30}
                  onClick={() => {
                    setNewShelfFolderName("");
                    setAddShelfFolderOpen(true);
                  }}
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center rounded-full border min-h-[28px] min-w-[28px] p-0",
                    "border-dashed border-primary/35 bg-primary/5 text-primary hover:bg-primary/12",
                    customShelfFolders.length >= 30 && "opacity-40 pointer-events-none",
                  )}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </TapScaleButton>
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
                          onClick={() => {
                            prefetchChatMessagesTail(queryClient, hit.chatId);
                            setLocation(
                              `/chat/${encodeURIComponent(hit.chatId)}?messageId=${encodeURIComponent(hit.messageId)}`,
                            );
                          }}
                          className="flex flex-col gap-0.5 p-2.5 rounded-lg hover:bg-secondary/50 cursor-pointer"
                        >
                          <span className="text-xs text-muted-foreground">{hit.chatName}</span>
                          <span className="text-sm truncate">
                            {formatMessageContentPreview(hit.type, hit.content, 200)}
                          </span>
                        </TapScaleDiv>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {listSectionTab === "push" ? (
              activePushLoading ? (
                <LoadingProgress loading minHeight="200px" className="rounded-xl">
                  <div className="min-h-[200px]" />
                </LoadingProgress>
              ) : activePushError ? (
                <ErrorWithRetry
                  title="Не удалось загрузить Push-ленту"
                  description="Проверьте интернет и попробуйте снова"
                  onRetry={() => (pushScope === "incoming" ? refetchPush() : refetchPushOutbox())}
                />
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/50 bg-card/60 p-1.5">
                    <div className="flex min-w-0 flex-1 items-center gap-1 sm:flex-none sm:flex-initial">
                      <TapScaleButton
                        type="button"
                        subtle
                        onClick={() => {
                          if (pushScope !== "incoming") {
                            setPushScopeRefetchPending(true);
                            setPushScope("incoming");
                          }
                          void refetchPush();
                        }}
                        className={cn(
                          "min-h-[32px] shrink-0 rounded-xl px-2.5 sm:px-3 text-[12px] font-medium",
                          pushScope === "incoming" ? "bg-primary/15 text-foreground" : "text-muted-foreground",
                        )}
                      >
                        Входящие
                      </TapScaleButton>
                      <TapScaleButton
                        type="button"
                        subtle
                        onClick={() => {
                          if (pushScope !== "outgoing") {
                            setPushScopeRefetchPending(true);
                            setPushScope("outgoing");
                          }
                          void refetchPushOutbox();
                        }}
                        className={cn(
                          "min-h-[32px] shrink-0 rounded-xl px-2.5 sm:px-3 text-[12px] font-medium",
                          pushScope === "outgoing" ? "bg-primary/15 text-foreground" : "text-muted-foreground",
                        )}
                      >
                        Исходящие
                      </TapScaleButton>
                    </div>
                    {pushScope === "outgoing" ? (
                      <TapScaleButton
                        type="button"
                        haptic
                        onClick={() => setCreateStandalonePushOpen(true)}
                        className="inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-xl border border-rose-300/40 bg-gradient-to-r from-rose-500 via-pink-500 to-orange-400 px-2.5 py-1 text-[12px] font-semibold text-white shadow-[0_4px_16px_-4px_rgba(236,72,153,0.45)] min-[1500px]:hidden"
                        aria-label="Создать Push"
                      >
                        <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-95" aria-hidden />
                        Создать Push
                      </TapScaleButton>
                    ) : null}
                    <TapScaleButton
                      type="button"
                      subtle
                      onClick={() => setLocation("/settings/notifications")}
                      className="ml-auto flex min-h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded-xl border border-border/45 bg-secondary/50 text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                      aria-label="Настройки уведомлений и пушей модуля Push"
                      title="Настройки уведомлений"
                    >
                      <Settings2 className="h-4 w-4" aria-hidden />
                    </TapScaleButton>
                  </div>
                  {showPushScopeSkeleton ? (
                    <PushFeedScopeSkeleton />
                  ) : activePushFeed.length === 0 ? (
                    pushScope === "incoming" ? (
                      <PushFeedEmptyIncoming onOpenPosts={() => setLocation("/posts")} />
                    ) : (
                      <PushFeedEmptyOutgoing onCreatePush={() => setCreateStandalonePushOpen(true)} />
                    )
                  ) : (
                    activePushFeed.map((item: PushFeedItem) => {
                    const previewText = item.text.trim();
                    const isExpanded = expandedPushPostIds.has(item.id);
                    const hasMedia = (item.mediaUrls?.length ?? 0) > 0 || Boolean(item.imageUrl);
                    const mediaUrl = item.mediaUrls?.[0] ?? item.imageUrl ?? null;
                    const postSeg = (item.postLinkCode || item.postId).trim();
                    const authorSeg =
                      item.postAuthorPublicId != null ? String(item.postAuthorPublicId) : encodeURIComponent(item.postAuthorId);
                    const postPath = `/u/${encodeURIComponent(authorSeg)}/p/${encodeURIComponent(postSeg)}`;
                    const pushMyEmoji = item.myReaction ?? pushSessionMyReaction[item.id];
                    const pushPickerOpen = pushReactionPickerPostId === item.id;
                    const pushReactionTotal = item.reactionsCount ?? 0;
                    const pushExpiresSubtleLabel = formatPushExpiresSubtleLabel(item.expiresAt);
                    const externalVideoInCaption = previewText
                      ? extractFirstExternalVideoUrl(previewText)
                      : null;
                    const captionMaskEmbed = externalVideoInCaption
                      ? parseExternalVideoUrl(externalVideoInCaption)
                      : null;
                    return (
                      <AttachPushViewRecording
                        key={item.id}
                        pushPostId={item.id}
                        enabled={Boolean(user?.id && pushScope === "incoming" && item.author.id !== user.id)}
                      >
                        {(setCardRef) => (
                      <motion.div
                        ref={setCardRef}
                        className={cn(
                          "group relative overflow-visible rounded-2xl border border-border/50 bg-card/70 p-3",
                          "shadow-[0_1px_0_rgba(255,255,255,0.05)]",
                          "transition-[box-shadow,border-color] duration-200 ease-out",
                          "hover:border-rose-300/35 hover:shadow-[0_14px_44px_-14px_rgba(236,72,153,0.16)]",
                          "dark:hover:shadow-[0_14px_44px_-14px_rgba(236,72,153,0.1)]",
                          "focus-within:border-rose-300/40 focus-within:shadow-[0_14px_44px_-14px_rgba(236,72,153,0.14)]",
                        )}
                        initial={chatListReducedMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: DURATION_NORMAL_S * 0.55, ease: EASING_OUT_BEZIER }}
                        whileTap={
                          chatListReducedMotion
                            ? undefined
                            : { scale: 0.985, transition: { duration: DURATION_FAST_MS / 1000, ease: EASING_OUT_BEZIER } }
                        }
                        onPointerDown={(e) => handlePushCardPointerDown(item.id, e.clientX)}
                        onPointerUp={(e) => handlePushCardPointerUp(item.id, e.clientX)}
                      >
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-x-3 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-rose-400/45 to-transparent opacity-40 transition-opacity duration-300 group-hover:opacity-90"
                        />
                        <div className="flex items-start gap-2.5">
                          <UserAvatar
                            avatarUrl={item.author.avatarUrl}
                            displayName={item.author.displayName}
                            seed={item.author.id}
                            size={36}
                            className="shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-[13px] font-semibold text-foreground">{item.author.displayName}</p>
                              {item.author.isBusiness ? (
                                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                                  Бизнес
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                              <span className="text-muted-foreground/90">{formatPostTime(item.createdAt)}</span>
                              {pushExpiresSubtleLabel ? (
                                <>
                                  <span className="mx-1 text-muted-foreground/30" aria-hidden>
                                    ·
                                  </span>
                                  <span
                                    className="text-[10px] font-normal tabular-nums tracking-[0.01em] text-muted-foreground/40"
                                    title={
                                      item.expiresAt
                                        ? `Исчезнет из Push-ленты: ${new Date(item.expiresAt).toLocaleString("ru-RU", {
                                            dateStyle: "short",
                                            timeStyle: "short",
                                          })}`
                                        : undefined
                                    }
                                    aria-label={
                                      item.expiresAt
                                        ? `Исчезнет из Push-ленты ${new Date(item.expiresAt).toLocaleString("ru-RU", {
                                            dateStyle: "long",
                                            timeStyle: "short",
                                          })}`
                                        : undefined
                                    }
                                  >
                                    {pushExpiresSubtleLabel}
                                  </span>
                                </>
                              ) : null}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">Push</span>
                            {pushScope === "incoming" ? (
                              <Switch
                                checked={item.author.notificationsEnabled !== false}
                                disabled={patchPushAuthorMutation.isPending}
                                onCheckedChange={(checked) =>
                                  patchPushAuthorMutation.mutate({ authorId: item.author.id, enabled: checked })
                                }
                                aria-label={`Уведомления Push от ${item.author.displayName}`}
                              />
                            ) : null}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <TapScaleButton
                                  type="button"
                                  subtle
                                  className="min-h-[28px] min-w-[28px] rounded-full border border-border/40 bg-secondary/40"
                                  aria-label={`Действия Push от ${item.author.displayName}`}
                                  onPointerDown={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                                </TapScaleButton>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-[220px]">
                                <DropdownMenuItem onClick={() => handlePushCardRemove(item.id)}>
                                  <Trash2 className="h-4 w-4" aria-hidden />
                                  Удалить Push
                                </DropdownMenuItem>
                                {pushScope === "incoming" ? (
                                  <DropdownMenuItem
                                    onClick={() => hidePushAuthorMutation.mutate({ authorId: item.author.id, hidden: true })}
                                  >
                                    <EyeOff className="h-4 w-4" aria-hidden />
                                    Скрыть все Push автора
                                  </DropdownMenuItem>
                                ) : null}
                                {pushScope === "incoming" ? (
                                  <DropdownMenuItem onClick={() => unsubscribePushAuthorMutation.mutate(item.author.id)}>
                                    <X className="h-4 w-4" aria-hidden />
                                    Отписаться от Push
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuItem onClick={() => void handlePushShareNative(item)}>
                                  <Share2 className="h-4 w-4" aria-hidden />
                                  Поделиться в сториз
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setPushShareTarget(item)}>
                                  <MessageCircle className="h-4 w-4" aria-hidden />
                                  Переслать в сообщение
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handlePushBlockAuthor(item.author.id)}>
                                  <Ban className="h-4 w-4" aria-hidden />
                                  Заблокировать пользователя
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void handlePushReport(item)}>
                                  <Flag className="h-4 w-4" aria-hidden />
                                  Пожаловаться
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        {hasMedia && mediaUrl ? (
                          <div className="mt-2 overflow-hidden rounded-xl border border-border/40 bg-muted/25">
                            {isLikelyPushVideoUrl(mediaUrl) ? (
                              <video
                                src={mediaUrl}
                                className={cn(
                                  "h-28 w-full object-cover bg-black/40",
                                  !chatListReducedMotion &&
                                    "transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]",
                                )}
                                muted
                                playsInline
                                loop
                                preload="metadata"
                                aria-label="Видео в Push"
                              />
                            ) : (
                              <img
                                src={mediaUrl}
                                alt=""
                                className={cn(
                                  "h-28 w-full object-cover",
                                  !chatListReducedMotion &&
                                    "transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]",
                                )}
                                loading="lazy"
                              />
                            )}
                          </div>
                        ) : null}
                        {previewText ? (
                          <p
                            className={cn(
                              "mt-2 text-[12px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words",
                              isExpanded ? "" : "line-clamp-3",
                            )}
                          >
                            <PostCaptionInlineParts
                              text={previewText}
                              maskExternalEmbed={captionMaskEmbed}
                              onHashtagClick={() => setLocation("/posts")}
                              linkClassName="text-primary underline decoration-primary/55 underline-offset-2 break-all"
                              hashtagClassName="text-primary font-medium hover:underline underline-offset-2"
                            />
                          </p>
                        ) : !hasMedia ? (
                          <p className={cn("mt-2 text-[12px] leading-relaxed text-muted-foreground", isExpanded ? "" : "line-clamp-3")}>
                            Новый микропост
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="tabular-nums">Уник. просмотры: {item.uniqueViewsCount ?? 0}</span>
                          <span>Реакций: {item.reactionsCount ?? 0}</span>
                          <span className="tabular-nums">Ответов: {item.repliesCount ?? 0}</span>
                          <TapScaleButton
                            type="button"
                            subtle
                            onClick={() => setPushRepliesTarget(item)}
                            className="min-h-[28px] rounded-full border border-border/40 bg-secondary/40 px-2.5 py-0.5 text-[11px] font-medium text-foreground/90"
                            aria-label="Открыть все ответы на этот Push"
                          >
                            Все ответы
                          </TapScaleButton>
                        </div>
                        {inlineReplyPushId === item.id ? (
                          <div
                            className="mt-2 space-y-2 rounded-xl border border-rose-300/25 bg-gradient-to-b from-rose-500/[0.06] to-transparent p-2.5"
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-medium text-muted-foreground">Видимость</span>
                              <TapScaleButton
                                type="button"
                                subtle
                                onClick={() => setInlineReplyVisibility("public")}
                                className={cn(
                                  "min-h-[28px] rounded-full border px-2.5 text-[11px]",
                                  inlineReplyVisibility === "public"
                                    ? "border-primary/35 bg-primary/12"
                                    : "border-border/50",
                                )}
                              >
                                Публичный
                              </TapScaleButton>
                              <TapScaleButton
                                type="button"
                                subtle
                                onClick={() => setInlineReplyVisibility("private")}
                                className={cn(
                                  "min-h-[28px] rounded-full border px-2.5 text-[11px]",
                                  inlineReplyVisibility === "private"
                                    ? "border-primary/35 bg-primary/12"
                                    : "border-border/50",
                                )}
                              >
                                Приватный
                              </TapScaleButton>
                            </div>
                            <textarea
                              ref={inlineReplyTextareaRef}
                              value={inlineReplyText}
                              onChange={(e) => setInlineReplyText(e.target.value)}
                              rows={3}
                              placeholder="Быстрый ответ на Push…"
                              className="w-full resize-none rounded-xl border border-border/60 bg-background/80 p-2.5 text-[13px] leading-snug outline-none focus:ring-2 focus:ring-primary/25"
                              aria-label="Текст ответа на Push"
                            />
                            <div className="flex flex-wrap gap-1.5">
                              <TapScaleButton
                                type="button"
                                onClick={handleInlinePushReplySubmit}
                                disabled={createPushReplyMutation.isPending}
                                className="min-h-[var(--uix-touch-min)] rounded-xl bg-primary px-3 text-[12px] text-primary-foreground disabled:opacity-50"
                              >
                                {createPushReplyMutation.isPending ? "Отправка…" : "Отправить"}
                              </TapScaleButton>
                              <TapScaleButton
                                type="button"
                                subtle
                                onClick={() => {
                                  setInlineReplyPushId(null);
                                  setInlineReplyText("");
                                }}
                                className="min-h-[var(--uix-touch-min)] rounded-xl border border-border/50 px-3 text-[12px]"
                              >
                                Свернуть
                              </TapScaleButton>
                            </div>
                          </div>
                        ) : null}
                        {item.latestReply ? (
                          <div className="mt-2 rounded-xl border border-border/40 bg-muted/20 px-2.5 py-2 transition-colors duration-200 group-hover:bg-muted/30 group-hover:border-border/55">
                            <p className="text-[11px] font-medium text-foreground">
                              Последний ответ · {item.latestReply.author.displayName}
                              {item.latestReply.visibility === "private" ? " (приватный)" : ""}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{item.latestReply.text}</p>
                          </div>
                        ) : null}
                        <div className="relative mt-3">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
                            <div className="flex min-w-0 flex-[1_1_12rem] items-center gap-1.5 overflow-hidden">
                              <button
                                type="button"
                                className={cn(
                                  "inline-flex min-h-[var(--uix-touch-min)] min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-xl bg-secondary/25 px-2.5 py-2 text-left transition-transform active:scale-[0.99] sm:max-w-[min(100%,240px)]",
                                  pushMyEmoji ? "bg-primary/10" : "",
                                )}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void triggerLightHaptic();
                                  if (pushMyEmoji) {
                                    void handlePushRemoveReact(item.id, item.postId);
                                  } else {
                                    setPushReactionPickerPostId(pushPickerOpen ? null : item.id);
                                  }
                                }}
                              >
                                {pushMyEmoji ? (
                                  <span className="text-[16px] leading-none">{pushMyEmoji}</span>
                                ) : pushReactionTotal === 0 ? (
                                  <SmilePlus
                                    className="h-[18px] w-[18px] shrink-0 text-muted-foreground"
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                ) : null}
                                <span
                                  className={cn(
                                    "text-[13px] font-semibold tabular-nums",
                                    pushReactionTotal === 0 && !pushMyEmoji
                                      ? "text-muted-foreground"
                                      : "text-foreground/90",
                                  )}
                                >
                                  {pushReactionTotal > 0 || pushMyEmoji
                                    ? formatCompactCountRu(pushReactionTotal)
                                    : "Реакции"}
                                </span>
                              </button>
                              <button
                                type="button"
                                className={cn(
                                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/30 transition-colors hover:bg-secondary/50 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]",
                                  pushPickerOpen ? "bg-primary/10 text-primary" : "text-muted-foreground",
                                )}
                                aria-label="Выбрать реакцию"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void triggerLightHaptic();
                                  setPushReactionPickerPostId(pushPickerOpen ? null : item.id);
                                }}
                              >
                                <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                              </button>
                            </div>

                            <div
                              className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-0.5 gap-y-2"
                              style={{ paddingRight: "max(0px, env(safe-area-inset-right, 0px))" }}
                            >
                              <button
                                type="button"
                                title="Ответить"
                                className={cn(
                                  "flex min-h-[var(--uix-touch-min)] items-center gap-1 rounded-lg px-1.5 py-1 text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground active:scale-[0.98]",
                                  inlineReplyPushId === item.id ? "bg-primary/10 text-primary" : "",
                                )}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void triggerLightHaptic();
                                  toggleInlineReplyForPush(item.id);
                                }}
                                aria-expanded={inlineReplyPushId === item.id}
                                aria-label={
                                  inlineReplyPushId === item.id ? "Свернуть ответ на Push" : "Ответить на Push"
                                }
                              >
                                <MessageSquare className="h-4 w-4 shrink-0 opacity-85" strokeWidth={2} aria-hidden />
                                <span className="text-[12px] font-semibold tabular-nums text-foreground/85">
                                  {formatCompactCountRu(item.repliesCount ?? 0)}
                                </span>
                              </button>
                              <button
                                type="button"
                                title="Поделиться"
                                className="flex min-h-[var(--uix-touch-min)] items-center justify-center rounded-lg px-2 py-1 text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground active:scale-[0.98]"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void triggerLightHaptic();
                                  setPushShareTarget(item);
                                }}
                                aria-label="Переслать Push в сообщение"
                              >
                                <Share2 className="h-4 w-4 shrink-0 opacity-85" strokeWidth={2} aria-hidden />
                              </button>
                              <button
                                type="button"
                                title="Открыть пост"
                                className="flex min-h-[var(--uix-touch-min)] items-center justify-center rounded-lg px-2 py-1 text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground active:scale-[0.98]"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void triggerLightHaptic();
                                  setLocation(postPath);
                                }}
                                aria-label="Открыть пост"
                              >
                                <ExternalLink className="h-4 w-4 shrink-0 opacity-85" strokeWidth={2} aria-hidden />
                              </button>
                              <button
                                type="button"
                                title={isExpanded ? "Свернуть текст" : "Показать весь текст"}
                                className="flex min-h-[var(--uix-touch-min)] w-11 shrink-0 items-center justify-center rounded-lg px-1 py-1 text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground active:scale-[0.98]"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void triggerLightHaptic();
                                  setExpandedPushPostIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(item.id)) next.delete(item.id);
                                    else next.add(item.id);
                                    return next;
                                  });
                                }}
                                aria-label={isExpanded ? "Свернуть текст" : "Открыть полностью"}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 opacity-85" strokeWidth={2} aria-hidden />
                                ) : (
                                  <ChevronDown className="h-4 w-4 opacity-85" strokeWidth={2} aria-hidden />
                                )}
                              </button>
                            </div>
                          </div>

                          {pushPickerOpen ? (
                            <div className="absolute left-0 top-full z-[60] mt-1.5 flex w-full max-w-[min(100%,360px)] justify-center sm:justify-start">
                              <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-border/40 bg-background/95 px-3 py-2 shadow-lg backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                                {USER_PROFILE_REACTION_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void triggerLightHaptic();
                                      playLikeActionSound();
                                      void handlePushReact(item.id, item.postId, emoji);
                                    }}
                                    className="flex h-10 w-10 items-center justify-center rounded-full text-2xl transition-transform hover:scale-110 active:scale-95"
                                    aria-label={`Реакция ${emoji}`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </motion.div>
                        )}
                      </AttachPushViewRecording>
                    );
                    })
                  )}
                </div>
              )
            ) : isLoading ? (
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
                      <div key="new-user-onboarding-above-ai" className="mb-1">
                        <NewUserFeedOnboardingStrip
                          userCreatedAt={user?.createdAt ?? null}
                          feedScrollRef={chatsListScrollRef}
                          className="mb-0"
                        />
                      </div>
                    ) : null}
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
                          isSelected={selectedChatId === AI_CHAT_ID}
                          onSelect={() => navigateToChat(aiOverChat)}
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
                        ...sectionChats.map((chat, sectionIndex) => (
                          <motion.div
                            key={chat.id}
                            layout
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={rowExit}
                            transition={
                              chatListReducedMotion
                                ? rowMotionTransition
                                : { ...rowMotionTransition, delay: Math.min(0.12, sectionIndex * 0.012) }
                            }
                          >
                            <ChatRow
                              chat={chat}
                              currentUserId={user?.id}
                              isSelected={selectedChatId === chat.id}
                              typingLabel={typingByChatId[chat.id] ?? null}
                              voiceLabel={voiceRecordingByChatId[chat.id] ?? null}
                              pendingUnreadHint={pendingUnreadChatIds.has(chat.id)}
                              composerTransferPulse={chat.type === "dm" && composerTransferRowIds.has(chat.id)}
                              onSelect={() => navigateToChat(chat)}
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
                      if (serviceMenuChatIsHidden) {
                        await patchChatMemberMe(c.id, { hidden: false });
                        refreshChatQueries();
                        await refetchHidden();
                        setServiceMenuChat(null);
                        toast({ title: "Чат снова в основном списке" });
                      } else {
                        await patchChatMemberMe(c.id, { hidden: true });
                        refreshChatQueries();
                        setServiceMenuChat(null);
                        toast({
                          title: "Чат скрыт",
                          description: "Потяните список вниз для обновления — скрытые чаты появятся вверху списка.",
                        });
                      }
                    } catch (e) {
                      toast({
                        title: "Не удалось",
                        description: e instanceof Error ? e.message : "Ошибка",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  {serviceMenuChatIsHidden ? (
                    <Eye className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <EyeOff className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  {serviceMenuChatIsHidden ? "Вернуть в основной список" : "Скрыть из списка"}
                </TapScaleButton>
                </div>

                <div className="space-y-2.5 rounded-2xl border border-border/45 bg-muted/12 p-3.5">
                  <div className="space-y-1.5">
                    <p className="text-[13px] font-semibold leading-tight text-foreground">В папку</p>
                  </div>
                  <div
                    className="-mx-0.5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-0.5 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    role="radiogroup"
                    aria-label="Папка для чата"
                  >
                  {shelfFolderAssignOptions.map((s) => {
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

      <Drawer
        open={folderShelfMenuTab !== null}
        onOpenChange={(o) => {
          if (!o) setFolderShelfMenuTab(null);
        }}
      >
        <DrawerContent className="max-h-[min(85dvh,640px)] rounded-t-[1.25rem] border-border/35 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="p-5 pb-2 text-left">
            <DrawerTitle className="text-left text-[1.0625rem] font-semibold">
              {folderShelfMenuMeta?.kind === "builtin"
                ? folderShelfMenuMeta.title
                : folderShelfMenuMeta?.kind === "custom"
                  ? folderShelfMenuMeta.title
                  : folderShelfMenuMeta?.kind === "synthetic" && folderShelfMenuMeta.synthetic === "push"
                    ? "Push"
                    : folderShelfMenuMeta?.kind === "synthetic" && folderShelfMenuMeta.synthetic === "all"
                      ? "Все чаты"
                      : "Полка"}
            </DrawerTitle>
          </DrawerHeader>
          <div className="space-y-3 px-5 pb-6">
            {folderShelfMenuMeta?.kind === "synthetic" && folderShelfMenuMeta.synthetic === "push" ? (
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Лента публикаций Push. Уведомления о{" "}
                <span className="font-medium text-foreground">сообщениях в чатах</span> настраиваются отдельно: удерживайте
                полку «Друзья», «Работа» или свою папку и переключите пункт про push.
              </p>
            ) : null}
            {folderShelfMenuMeta?.kind === "synthetic" && folderShelfMenuMeta.synthetic === "all" ? (
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Здесь все чаты, кроме полки «Приглашения». Чтобы разложить диалоги по папкам, долго удерживайте чат → «В
                папку». Чтобы переименовать полку или отключить для неё push, удерживайте вкладку полки (~1,3 с).
              </p>
            ) : null}
            {folderShelfMenuMeta?.kind === "builtin" || folderShelfMenuMeta?.kind === "custom" ? (
              <>
                <TapScaleButton
                  type="button"
                  haptic
                  subtle
                  className="flex h-auto min-h-[var(--uix-touch-min)] w-full items-center gap-3 rounded-2xl border border-border/50 bg-muted/20 px-4 py-3 text-left text-[15px] font-medium"
                  onClick={() => {
                    const meta = folderShelfMenuMeta;
                    if (meta?.kind === "builtin") {
                      setRenameShelfTarget({ kind: "builtin", tabId: meta.tabId });
                      setRenameShelfValue(meta.title);
                    } else if (meta?.kind === "custom") {
                      setRenameShelfTarget({ kind: "custom", id: meta.id });
                      setRenameShelfValue(meta.title);
                    }
                    setRenameShelfOpen(true);
                    setFolderShelfMenuTab(null);
                  }}
                >
                  <Edit className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  Переименовать вкладку
                </TapScaleButton>
                <TapScaleButton
                  type="button"
                  haptic
                  subtle
                  className="flex h-auto min-h-[var(--uix-touch-min)] w-full items-center gap-3 rounded-2xl border border-border/50 bg-muted/20 px-4 py-3 text-left text-[15px] font-medium"
                  onClick={async () => {
                    const meta = folderShelfMenuMeta;
                    if (meta?.kind !== "builtin" && meta?.kind !== "custom") return;
                    const next = !meta.pushMuted;
                    try {
                      if (meta.kind === "builtin") {
                        await patchChatListBuiltinTabPref(meta.tabId, { pushMuted: next });
                      } else {
                        await patchChatListCustomFolder(meta.id, { pushMuted: next });
                      }
                      void queryClient.invalidateQueries({ queryKey: ["chat-list-shelves"] });
                      setFolderShelfMenuTab(null);
                      toast({
                        title: next
                          ? "Push-уведомления выключены для этой полки"
                          : "Push-уведомления включены для этой полки",
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
                  {folderShelfMenuMeta && (folderShelfMenuMeta.kind === "builtin" || folderShelfMenuMeta.kind === "custom")
                    ? folderShelfMenuMeta.pushMuted
                      ? (
                          <BellOff className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                        )
                      : (
                          <Bell className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                        )
                    : null}
                  {folderShelfMenuMeta && (folderShelfMenuMeta.kind === "builtin" || folderShelfMenuMeta.kind === "custom")
                    ? folderShelfMenuMeta.pushMuted
                      ? "Включить push-уведомления для полки"
                      : "Отключить push-уведомления для полки"
                    : null}
                </TapScaleButton>
                {folderShelfMenuMeta?.kind === "custom" ? (
                  <TapScaleButton
                    type="button"
                    haptic
                    subtle
                    className="flex h-auto min-h-[var(--uix-touch-min)] w-full items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/15 px-4 py-3 text-left text-[15px] font-semibold text-destructive"
                    onClick={() => {
                      setConfirmDeleteShelfId(folderShelfMenuMeta.id);
                      setFolderShelfMenuTab(null);
                    }}
                  >
                    <Trash2 className="h-5 w-5 shrink-0" aria-hidden />
                    Удалить папку…
                  </TapScaleButton>
                ) : null}
              </>
            ) : null}
            {folderShelfMenuMeta?.kind === "unknown" ? (
              <p className="text-sm text-muted-foreground">Не удалось распознать вкладку.</p>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog
        open={addShelfFolderOpen}
        onOpenChange={(o) => {
          setAddShelfFolderOpen(o);
          if (!o) setNewShelfFolderName("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Новая папка</DialogTitle>
          </DialogHeader>
          <label className="text-sm font-medium">Название</label>
          <input
            type="text"
            value={newShelfFolderName}
            onChange={(e) => setNewShelfFolderName(e.target.value)}
            placeholder="Например: Семья"
            maxLength={40}
            className="w-full bg-secondary/50 border border-border rounded-xl py-2.5 px-3 text-[15px] focus:ring-2 focus:ring-primary/30 outline-none"
          />
          <DialogFooter className="gap-2">
            <TapScaleButton
              type="button"
              className="min-h-[var(--uix-touch-min)] border border-input bg-background"
              onClick={() => setAddShelfFolderOpen(false)}
            >
              Отмена
            </TapScaleButton>
            <TapScaleButton
              type="button"
              className="min-h-[var(--uix-touch-min)] bg-primary text-primary-foreground"
              disabled={shelfCreateLoading || !newShelfFolderName.trim()}
              onClick={async () => {
                const name = newShelfFolderName.trim();
                if (!name) return;
                setShelfCreateLoading(true);
                try {
                  await createChatListCustomFolder(name);
                  void queryClient.invalidateQueries({ queryKey: ["chat-list-shelves"] });
                  setAddShelfFolderOpen(false);
                  setNewShelfFolderName("");
                  toast({ title: "Папка создана" });
                } catch (e) {
                  toast({
                    title: e instanceof Error ? e.message : "Не удалось создать",
                    variant: "destructive",
                  });
                } finally {
                  setShelfCreateLoading(false);
                }
              }}
            >
              {shelfCreateLoading ? "Создание…" : "Создать"}
            </TapScaleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renameShelfOpen}
        onOpenChange={(o) => {
          setRenameShelfOpen(o);
          if (!o) setRenameShelfTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Переименовать</DialogTitle>
          </DialogHeader>
          <input
            type="text"
            value={renameShelfValue}
            onChange={(e) => setRenameShelfValue(e.target.value)}
            maxLength={40}
            className="w-full bg-secondary/50 border border-border rounded-xl py-2.5 px-3 text-[15px] focus:ring-2 focus:ring-primary/30 outline-none"
          />
          {renameShelfTarget?.kind === "builtin" ? (
            <p className="text-xs text-muted-foreground">
              Оставьте поле пустым и нажмите «Сохранить», чтобы вернуть стандартное название полки.
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <TapScaleButton
              type="button"
              className="min-h-[var(--uix-touch-min)] border bg-background"
              onClick={() => setRenameShelfOpen(false)}
            >
              Отмена
            </TapScaleButton>
            <TapScaleButton
              type="button"
              className="min-h-[var(--uix-touch-min)] bg-primary text-primary-foreground"
              disabled={
                !renameShelfTarget || (renameShelfTarget.kind === "custom" && !renameShelfValue.trim())
              }
              onClick={async () => {
                if (!renameShelfTarget) return;
                try {
                  if (renameShelfTarget.kind === "builtin") {
                    await patchChatListBuiltinTabPref(renameShelfTarget.tabId, {
                      labelOverride: renameShelfValue.trim() || null,
                    });
                  } else {
                    const nm = renameShelfValue.trim();
                    if (!nm) {
                      toast({ title: "Введите название", variant: "destructive" });
                      return;
                    }
                    await patchChatListCustomFolder(renameShelfTarget.id, { name: nm });
                  }
                  void queryClient.invalidateQueries({ queryKey: ["chat-list-shelves"] });
                  setRenameShelfOpen(false);
                  setRenameShelfTarget(null);
                  toast({ title: "Сохранено" });
                } catch (e) {
                  toast({
                    title: e instanceof Error ? e.message : "Не удалось",
                    variant: "destructive",
                  });
                }
              }}
            >
              Сохранить
            </TapScaleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteShelfId !== null} onOpenChange={(o) => !o && setConfirmDeleteShelfId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить папку?</AlertDialogTitle>
            <AlertDialogDescription>
              Чаты из этой папки вернутся в раздел «Общие» (на вкладке «Все»).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <TapScaleButton
              type="button"
              haptic
              className="inline-flex min-h-[var(--uix-touch-min)] items-center justify-center rounded-md bg-destructive px-4 text-destructive-foreground"
              disabled={deleteShelfLoading}
              onClick={async () => {
                if (!confirmDeleteShelfId) return;
                setDeleteShelfLoading(true);
                try {
                  await deleteChatListCustomFolder(confirmDeleteShelfId);
                  if (listSectionTab === confirmDeleteShelfId) setListSectionTab("all");
                  void queryClient.invalidateQueries({ queryKey: ["chat-list-shelves"] });
                  void queryClient.invalidateQueries({ queryKey: ["chats"] });
                  setConfirmDeleteShelfId(null);
                  toast({ title: "Папка удалена" });
                } catch (e) {
                  toast({
                    title: e instanceof Error ? e.message : "Не удалось",
                    variant: "destructive",
                  });
                } finally {
                  setDeleteShelfLoading(false);
                }
              }}
            >
              {deleteShelfLoading ? "Удаление…" : "Удалить"}
            </TapScaleButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              <TapScaleButton
                type="button"
                haptic
                className="h-11 w-full rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/15 inline-flex items-center justify-center gap-2 disabled:opacity-50"
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
              </TapScaleButton>
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
              <TapScaleButton
                type="button"
                haptic
                className="h-11 w-full rounded-xl bg-destructive text-destructive-foreground shadow-md shadow-destructive/20 border border-destructive-border inline-flex items-center justify-center gap-2 disabled:opacity-50"
                disabled={deleteInProgress !== null}
                onClick={() => void runDeleteForAll()}
              >
                {deleteInProgress === "forAll" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  "Удалить навсегда"
                )}
              </TapScaleButton>
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
                        pointerEventsNone
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
                  navigateToChat(chat);
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

      <Dialog
        open={pushRepliesTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPushRepliesTarget(null);
        }}
      >
        <DialogContent className="max-h-[85vh] flex flex-col gap-3 sm:max-w-lg">
          <DialogHeader className="space-y-1">
            <DialogTitle>Ответы на Push</DialogTitle>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Ответ пишите в карточке через «Ответить». Здесь — полный список с фильтром.
            </p>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground shrink-0">Показать:</span>
            <TapScaleButton
              type="button"
              subtle
              onClick={() => setPushRepliesVisibilityFilter("all")}
              className={cn(
                "min-h-[32px] rounded-full border px-3 text-[12px]",
                pushRepliesVisibilityFilter === "all" ? "border-primary/30 bg-primary/10" : "border-border/50",
              )}
            >
              Все
            </TapScaleButton>
            <TapScaleButton
              type="button"
              subtle
              onClick={() => setPushRepliesVisibilityFilter("public")}
              className={cn(
                "min-h-[32px] rounded-full border px-3 text-[12px]",
                pushRepliesVisibilityFilter === "public" ? "border-primary/30 bg-primary/10" : "border-border/50",
              )}
            >
              Только публичные
            </TapScaleButton>
            {!pushRepliesLoading && !pushRepliesError ? (
              <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
                {pushRepliesFlat.length}/{pushRepliesTotal}
              </span>
            ) : null}
          </div>
          <div className="border border-border rounded-xl overflow-y-auto max-h-[min(48dvh,360px)] min-h-[140px] divide-y divide-border flex flex-col">
            {pushRepliesLoading ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
              </div>
            ) : pushRepliesError ? (
              <div className="p-3">
                <ErrorWithRetry
                  title="Не удалось загрузить ответы"
                  description="Проверьте сеть и попробуйте снова"
                  onRetry={() => void refetchPushRepliesPages()}
                />
              </div>
            ) : pushRepliesFlat.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">
                {pushRepliesVisibilityFilter === "public" ? "Публичных ответов пока нет." : "Пока нет ответов."}
              </p>
            ) : (
              pushRepliesFlat.map((reply: PushReplyItem) => (
                <div key={reply.id} className="p-3">
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      avatarUrl={reply.author.avatarUrl ?? undefined}
                      displayName={reply.author.displayName}
                      seed={reply.author.id}
                      size={28}
                    />
                    <p className="text-[12px] font-medium">
                      {reply.author.displayName}
                      {reply.visibility === "private" ? " · приватный" : ""}
                    </p>
                  </div>
                  <p className="mt-1 text-[12px] text-foreground/90 whitespace-pre-wrap">{reply.text}</p>
                </div>
              ))
            )}
          </div>
          {pushRepliesHasNext ? (
            <TapScaleButton
              type="button"
              subtle
              disabled={pushRepliesFetchingNext}
              onClick={() => void fetchNextPushReplies()}
              className="min-h-[var(--uix-touch-min)] w-full rounded-xl border border-border/50 text-[13px] font-medium"
            >
              {pushRepliesFetchingNext ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Загрузка…
                </span>
              ) : (
                "Загрузить ещё"
              )}
            </TapScaleButton>
          ) : null}
        </DialogContent>
      </Dialog>

      <CreateStandalonePushDrawer open={createStandalonePushOpen} onOpenChange={setCreateStandalonePushOpen} />

      <Dialog open={pushShareTarget !== null} onOpenChange={(open) => !open && setPushShareTarget(null)}>
        <DialogContent className="max-h-[85vh] flex flex-col gap-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Переслать Push в сообщение</DialogTitle>
          </DialogHeader>
          <div className="border border-border rounded-xl overflow-y-auto max-h-[52vh] min-h-[120px] divide-y divide-border">
            {contactsList.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">
                Нет контактов для пересылки.
              </p>
            ) : (
              contactsList.map((contact) => (
                <TapScaleButton
                  key={contact.id}
                  type="button"
                  subtle
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-secondary/50 min-h-[var(--uix-touch-min)]"
                  onClick={() => pushShareTarget && void handleForwardPushToUser(pushShareTarget, contact.id)}
                >
                  <UserAvatar
                    avatarUrl={contact.avatarUrl ?? undefined}
                    displayName={contactDisplayName(contact)}
                    seed={String(contact.id)}
                    size={36}
                    className="w-9 h-9"
                    pointerEventsNone
                  />
                  <span className="font-medium text-[14px] truncate">{contactDisplayName(contact)}</span>
                </TapScaleButton>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}