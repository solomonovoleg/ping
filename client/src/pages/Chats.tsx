import { useState, useEffect, useRef, memo } from "react";
import { flushSync } from "react-dom";
import { useLocation } from "wouter";
import { Search, Edit, MessageCircle, Phone, Video, X, UserPlus, ChevronLeft, Mic, Pin, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/GlobalSearch";
import { UserAvatar } from "@/components/UserAvatar";
import { useCallContext } from "@/contexts/CallContext";
import { useAuth } from "@/contexts/AuthContext";

import { API, apiFetch } from "@/lib/api-base";
import { listContactsWithProfiles, type ContactUser } from "@/lib/users";
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
import { searchMessages, type SearchMessageHit } from "@/lib/chat";
import { AI_CHAT_ID } from "@/features/chat/constants";
import { usePrefersReducedMotion } from "@/lib/motion";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER } from "@/lib/motion";
import { formatTimeLocal, formatDateShortLocal } from "@/lib/timezone";

type ApiChat = {
  id: string;
  type: string;
  name: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  otherMember?: { id: string; publicId: number } | null;
  otherMemberAvatarUrl?: string | null;
  otherMemberLastSeenAt?: string | null;
  otherMemberHasActiveStory?: boolean;
  otherMemberHasUnseenStory?: boolean;
  lastMessage?: { type: string; content: string; createdAt: string } | null;
  hasUnread?: boolean;
  unreadCount?: number;
};

/** Формат статуса «в сети» / «был(а) недавно» / «был(а) в HH:MM» (локальное время). */
function formatLastSeen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
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
  const res = await apiFetch(`${API}/chats`, { cache: "no-store" });
  if (!res.ok) throw new Error("Не удалось загрузить чаты");
  return res.json();
}

function formatChatTime(createdAt: string): string {
  const d = new Date(createdAt);
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
  const d = new Date(iso);
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

/** Строка чата: мемоизация уменьшает перерисовку списка при обновлении «печатает»/«записывает» только в одном чате */
const ChatRow = memo(function ChatRow({
  chat,
  typingLabel,
  voiceLabel,
  onSelect,
  isAiChat,
}: {
  chat: ApiChat;
  typingLabel: string | null;
  voiceLabel: string | null;
  onSelect: () => void;
  isAiChat?: boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const preview =
    voiceLabel != null ? (
      <span className="text-primary/90 flex items-center gap-1">
        <Mic className="w-3 h-3 flex-shrink-0" />
        {voiceLabel} записывает голосовое
      </span>
    ) : typingLabel != null ? (
      <span className="italic text-primary/90">{typingLabel} печатает...</span>
    ) : (
      chat.lastMessage?.content ?? "Нет сообщений"
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
              "truncate text-[15px] font-semibold leading-5 sm:text-[16px]",
              isAiChat && "text-indigo-700 dark:text-indigo-200",
              chat.hasUnread && !isAiChat && "text-foreground"
            )}
          >
            {chat.name ?? (chat.type === "dm" ? "Диалог" : "Чат")}
          </h3>
          <span className="flex-shrink-0 text-[11px] text-muted-foreground/90 sm:text-xs">
            {formatChatTime(chat.lastMessage?.createdAt ?? chat.createdAt)}
          </span>
        </div>
        <p
          className={cn(
            "mt-0.5 truncate text-[13px] leading-[1.25rem] sm:text-[13.5px]",
            isAiChat ? "text-indigo-600/90 dark:text-indigo-400/90" : chat.hasUnread ? "text-foreground/80 font-medium" : "text-muted-foreground"
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

  const hasUnread = chat.hasUnread === true;
  const unreadCount = Math.max(0, chat.unreadCount ?? 0);
  const badgeLabel = unreadCount <= 0 ? "" : unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <TapScaleDiv
      onClick={onSelect}
      className={cn(
        "uix-list-row flex min-h-[52px] cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors duration-75 sm:min-h-[var(--uix-touch-min)] sm:gap-3 sm:rounded-2xl sm:px-2.5 sm:py-2.5",
        "border-border/20 hover:bg-secondary/40",
        hasUnread
          ? "bg-secondary/60 hover:bg-secondary/70 dark:bg-secondary/45 dark:hover:bg-secondary/55"
          : "bg-card/60 hover:bg-secondary/50"
      )}
    >
      {content}
      {hasUnread && badgeLabel && (
        <span
          className="flex-shrink-0 inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-none text-primary-foreground"
          aria-label={`${unreadCount} непрочитанных`}
        >
          {badgeLabel}
        </span>
      )}
    </TapScaleDiv>
  );
});

export default function Chats() {
  const [, setLocation] = useLocation();
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
  const [typingByChatId, setTypingByChatId] = useState<Record<string, string | null>>({});
  const [voiceRecordingByChatId, setVoiceRecordingByChatId] = useState<Record<string, string | null>>({});
  const [messageSearchResults, setMessageSearchResults] = useState<SearchMessageHit[]>([]);
  const [messageSearchLoading, setMessageSearchLoading] = useState(false);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const voiceTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { subscribeChat, subscribeTyping, subscribeVoiceRecording } = useCallContext();

  const { data: chats = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["chats"],
    queryFn: fetchChats,
    refetchOnMount: "always",
  });

  // Подписка на все чаты: новые сообщения → обновить список; типинг и запись ГС → показать в превью
  useEffect(() => {
    if (!chats.length) return;
    const unsubs: Array<() => void> = [];
    chats.forEach((chat) => {
      const chatId = chat.id;
      unsubs.push(
        subscribeChat(chatId, () => {
          window.dispatchEvent(new CustomEvent("ping:chat-list-update"));
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
  }, [chats, user?.id, subscribeChat, subscribeTyping, subscribeVoiceRecording]);

  const { data: contactsList = [] } = useQuery({
    queryKey: ["contacts", "list"],
    queryFn: listContactsWithProfiles,
    enabled: showContactsPage || showCreateGroupModal,
  });

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
  const chatsSortedByLastMessage = [...filteredChats].sort((a, b) => {
    const aTs = Date.parse(a.lastMessage?.createdAt ?? a.createdAt);
    const bTs = Date.parse(b.lastMessage?.createdAt ?? b.createdAt);
    return bTs - aTs;
  });
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
          <div className="uix-content-x pt-6 pb-2 glass z-20 sticky top-0 border-b border-border/50">
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
              <div
                className="flex items-center gap-3 p-3 ml-1 mb-2 hover:bg-secondary/50 rounded-2xl cursor-pointer text-primary font-medium transition-colors"
                onClick={() => { setShowContactsPage(false); setContactsSearchQuery(""); }}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                Добавить контакт (поиск в «Чаты»)
              </div>
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
                              setLocation(`/chat/${chat.otherMember?.publicId ?? chat.id}`);
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
                                  setLocation(`/chat/${chat.otherMember?.publicId ?? chat.id}`);
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
                                  setLocation(`/chat/${chat.otherMember?.publicId ?? chat.id}`);
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
                                  setLocation(`/chat/${chat.otherMember?.publicId ?? chat.id}`);
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
        <div className="uix-content-x pt-safe-offset-2 pb-2 sm:pt-4 sm:pb-2.5 glass z-20 sticky top-0 border-b border-border/50">
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
        <PullToRefresh onRefresh={() => refetch()} className="min-h-0">
          <div className="uix-content-x py-2 sm:py-2.5 pb-[calc(var(--uix-nav-bottom)+var(--uix-space-3))] space-y-1">
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
                          onClick={() => setLocation(`/chat/${hit.chatId}?messageId=${hit.messageId}`)}
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
                title={chats.length === 0 ? "У вас пока нет чатов" : "Нет чатов по запросу"}
                description={
                  chats.length === 0
                    ? "Найдите пользователя через поиск и начните диалог"
                    : "Измените поиск или выберите другой фильтр"
                }
                actionLabel={chats.length === 0 ? "Найти человека" : undefined}
                onAction={chats.length === 0 ? () => setShowContactsPage(true) : undefined}
              />
            ) : (
              (() => {
                const chatsWithoutAi = chatsSortedByLastMessage.filter((c) => c.id !== AI_CHAT_ID);
                const bySection = groupChatsByDateSection(chatsWithoutAi);
                return [
                  ...(showAiOver
                    ? [
                        <motion.p
                          key="ai-over-label"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: DURATION_NORMAL_S * 0.6, ease: EASING_OUT_BEZIER }}
                          className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground px-1 py-1.5 sm:py-2"
                        >
                          <Pin className="w-3 h-3 text-indigo-500/80" aria-hidden />
                          Закреплён
                        </motion.p>,
                        <ChatRow
                          key={AI_CHAT_ID}
                          chat={aiOverChat}
                          typingLabel={null}
                          voiceLabel={null}
                          onSelect={() => setLocation(`/chat/${AI_CHAT_ID}`)}
                          isAiChat
                        />,
                      ]
                    : []),
                  ...DATE_SECTION_ORDER.flatMap((key) => {
                    const sectionChats = bySection.get(key) ?? [];
                    if (sectionChats.length === 0) return [];
                    return [
                      <p key={key} className="text-[11px] font-medium text-muted-foreground px-1 py-1.5 sm:py-2">
                        {DATE_SECTION_LABELS[key]}
                      </p>,
                      ...sectionChats.map((chat) => (
                        <ChatRow
                          key={chat.id}
                          chat={chat}
                          typingLabel={typingByChatId[chat.id] ?? null}
                          voiceLabel={voiceRecordingByChatId[chat.id] ?? null}
                          onSelect={() => setLocation(`/chat/${chat.otherMember?.publicId ?? chat.id}`)}
                        />
                      )),
                    ];
                  }),
                ];
              })()
            )}
          </div>
        </PullToRefresh>
      </div>

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
                  setLocation(`/chat/${chat.id}`);
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