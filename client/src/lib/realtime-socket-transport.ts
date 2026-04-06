import type { MutableRefObject } from "react";
import { getCallToken, openCallRealtimeWebSocket, CallTokenUnauthorizedError } from "@/lib/calls";
import { toast } from "@/hooks/use-toast";
import {
  emitChatListUpdate,
  emitChatRead,
  emitIncomingChatMessageHint,
  emitGroupCallInvite,
  emitMessageEdited,
  emitMessageReaction,
  emitChatVibeUpdate,
  emitChatVibeTensionPulse,
  emitComposerTransferPulse,
  emitRealtimeSocketConnected,
} from "@/features/chat/realtime-events";

export type ChatMessagePayload = {
  id: string;
  chatId: string;
  senderId: string | null;
  type: string;
  content: string;
  createdAt: string;
  folderId?: string | null;
  transcript?: string | null;
  videoPosterUrl?: string | null;
  translatedText?: string;
  detectedLang?: string;
  translateTargetLang?: string;
};

type RawIncomingMessage = Record<string, unknown> & {
  type?: string;
  chatId?: string;
  message?: ChatMessagePayload;
  fromUserId?: string;
  fromDisplayName?: string;
};

export type RealtimeLinkState = "idle" | "connecting" | "open" | "closed";

type TransportParams = {
  wsRef: MutableRefObject<WebSocket | null>;
  callMessageHandlerRef: MutableRefObject<(raw: Record<string, unknown>) => void>;
  onSocketDisconnectedRef: MutableRefObject<() => void>;
  onSocketConnectedRef: MutableRefObject<() => void>;
  /** UI: индикатор подключения / reconnect без лишних подписок на ws */
  linkStateNotifierRef: MutableRefObject<(state: RealtimeLinkState) => void>;
};

type SendJsonOptions = {
  queueOnDisconnect?: boolean;
  dedupeKey?: string;
};

const WS_OPEN_TIMEOUT_MS = 12000;
const BACKGROUND_CONNECT_MAX_RETRIES = 5;
const OUTGOING_QUEUE_MAX = 300;
const OUTGOING_QUEUE_TTL_MS = 30_000;
const RECONNECT_BASE_MS = 900;
const RECONNECT_MAX_MS = 15_000;
const RECONNECT_JITTER_RATIO = 0.3;
const RECONNECT_WINDOW_MS = 60_000;
const RECONNECT_WINDOW_LIMIT = 12;
const RECONNECT_CIRCUIT_BREAKER_MS = 20_000;
/** Если WS завис в CONNECTING после возврата на вкладку — сброс и новый коннект */
const STUCK_CONNECTING_MS = 14_000;

type QueuedOutgoingItem = {
  payload: string;
  dedupeKey?: string;
  queuedAt: number;
};

let realtimeRefetchAuthToastShown = false;

export class RealtimeSocketTransport {
  private readonly wsRef: MutableRefObject<WebSocket | null>;
  private readonly callMessageHandlerRef: MutableRefObject<(raw: Record<string, unknown>) => void>;
  private readonly onSocketDisconnectedRef: MutableRefObject<() => void>;
  private readonly onSocketConnectedRef: MutableRefObject<() => void>;
  private readonly linkStateNotifierRef: MutableRefObject<(state: RealtimeLinkState) => void>;
  private connectingStartedAt = 0;
  private readonly chatListenersRef = new Map<string, Set<(msg: ChatMessagePayload) => void>>();
  private readonly messageDeletedListenersRef = new Map<string, Set<(messageId: string) => void>>();
  private readonly typingListenersRef = new Map<
    string,
    Set<(userId: string, displayName: string | null, active: boolean) => void>
  >();
  private readonly voiceRecordingListenersRef = new Map<
    string,
    Set<(userId: string, displayName: string | null, recording: boolean) => void>
  >();
  private readonly composerPulseListenersRef = new Map<
    string,
    Set<(userId: string, displayName: string | null, at: number) => void>
  >();
  /** chatId с открытой страницей диалога — сервер разрешает mark-chat-read только для них */
  private readonly threadOpenChatIdsRef = new Set<string>();
  private scheduleReconnect: (() => void) | null = null;
  private outgoingQueue: QueuedOutgoingItem[] = [];
  /** Один одновременный коннект: иначе два параллельных `ensureOpenWs` (звонок + фон) открывают два WS → лишняя нагрузка на сервер. */
  private wsOpenInflight: Promise<WebSocket> | null = null;
  /** Инкремент при принудительном сбросе (зависший CONNECTING) — старый `openWsWithNewToken` не должен затирать ref. */
  private ensureOpenJobId = 0;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimestamps: number[] = [];
  private reconnectCircuitOpenUntil = 0;

  constructor(params: TransportParams) {
    this.wsRef = params.wsRef;
    this.callMessageHandlerRef = params.callMessageHandlerRef;
    this.onSocketDisconnectedRef = params.onSocketDisconnectedRef;
    this.onSocketConnectedRef = params.onSocketConnectedRef;
    this.linkStateNotifierRef = params.linkStateNotifierRef;
  }

  private notifyLinkState(state: RealtimeLinkState): void {
    if (state === "connecting") {
      this.connectingStartedAt = Date.now();
    } else {
      this.connectingStartedAt = 0;
    }
    try {
      this.linkStateNotifierRef.current(state);
    } catch {
      /* ignore */
    }
  }

  closeWs = (): void => {
    this.notifyLinkState("closed");
    const prev = this.wsRef.current;
    this.wsRef.current = null;
    if (prev) {
      try {
        prev.close();
      } catch {
        /* ignore */
      }
    }
    this.outgoingQueue = [];
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  };

  /** Сброс при выходе из аккаунта — иначе id чата «висит» до следующего входа */
  clearOpenThreadChatIds = (): void => {
    this.threadOpenChatIdsRef.clear();
  };

  sendJson = (data: Record<string, unknown>, opts?: SendJsonOptions): boolean => {
    const payload = JSON.stringify(data);
    const queueOnDisconnect = opts?.queueOnDisconnect ?? true;
    const ws = this.wsRef.current;
    if (ws?.readyState === 1) {
      try {
        ws.send(payload);
        return true;
      } catch (e) {
        console.error("[realtime] send failed", e);
      }
    }
    if (!queueOnDisconnect) return false;
    this.enqueueOutgoing(payload, opts?.dedupeKey);
    this.scheduleReconnect?.();
    /**
     * Дожимаем /calls только по «крупным» событиям звонка. Для call.ice-candidate нельзя —
     * при обрыве WS десятки кандидатов вызывали бы лишние параллельные попытки открытия.
     */
    if (
      typeof data.type === "string" &&
      (data.type === "call.invite" ||
        data.type === "call.accept" ||
        data.type === "call.offer" ||
        data.type === "call.answer" ||
        data.type === "call.cancel" ||
        data.type === "call.hangup" ||
        data.type === "call.reject" ||
        data.type === "call.resume-check" ||
        data.type === "call.resume-request")
    ) {
      void this.ensureOpenWs().catch(() => {});
    }
    return false;
  };

  private enqueueOutgoing(payload: string, dedupeKey?: string): void {
    const now = Date.now();
    this.outgoingQueue = this.outgoingQueue.filter((item) => now - item.queuedAt <= OUTGOING_QUEUE_TTL_MS);
    if (dedupeKey) {
      this.outgoingQueue = this.outgoingQueue.filter((item) => item.dedupeKey !== dedupeKey);
    }
    this.outgoingQueue.push({ payload, dedupeKey, queuedAt: now });
    if (this.outgoingQueue.length > OUTGOING_QUEUE_MAX) {
      this.outgoingQueue = this.outgoingQueue.slice(this.outgoingQueue.length - OUTGOING_QUEUE_MAX);
    }
  }

  private flushOutgoingQueue(): void {
    const ws = this.wsRef.current;
    if (!ws || ws.readyState !== 1 || this.outgoingQueue.length === 0) return;
    const now = Date.now();
    const pending = this.outgoingQueue;
    this.outgoingQueue = [];
    for (const item of pending) {
      if (now - item.queuedAt > OUTGOING_QUEUE_TTL_MS) continue;
      try {
        ws.send(item.payload);
      } catch (e) {
        console.error("[realtime] flush queued message failed", e);
        this.outgoingQueue.unshift(item);
        break;
      }
    }
  }

  private sendSubscribeChat = (ws: WebSocket, chatId: string): void => {
    if (ws.readyState !== 1) return;
    try {
      ws.send(JSON.stringify({ type: "subscribe-chat", chatId }));
    } catch (e) {
      console.error("[realtime] send subscribe-chat failed", chatId, e);
    }
  };

  private sendUnsubscribeChat = (chatId: string): void => {
    const ws = this.wsRef.current;
    if (ws?.readyState !== 1) return;
    try {
      ws.send(JSON.stringify({ type: "unsubscribe-chat", chatId }));
    } catch (e) {
      console.error("[realtime] send unsubscribe-chat failed", chatId, e);
    }
  };

  private sendSubscribeChatThreadPacket = (ws: WebSocket, chatId: string): void => {
    if (ws.readyState !== 1) return;
    try {
      ws.send(JSON.stringify({ type: "subscribe-chat-thread", chatId }));
    } catch (e) {
      console.error("[realtime] send subscribe-chat-thread failed", chatId, e);
    }
  };

  /** Страница чата открыта — сервер вносит сокет в множество для mark-chat-read */
  sendSubscribeChatThread = (chatId: string): void => {
    if (!chatId) return;
    this.threadOpenChatIdsRef.add(chatId);
    const ws = this.wsRef.current;
    if (ws) this.sendSubscribeChatThreadPacket(ws, chatId);
    else {
      this.sendJson(
        { type: "subscribe-chat-thread", chatId },
        { dedupeKey: `thread-open:${chatId}`, queueOnDisconnect: true },
      );
    }
  };

  /** Уход со страницы чата — сразу снимаем «диалог открыт» на сервере */
  sendUnsubscribeChatThread = (chatId: string): void => {
    if (!chatId) return;
    this.threadOpenChatIdsRef.delete(chatId);
    this.sendJson({ type: "unsubscribe-chat-thread", chatId }, { queueOnDisconnect: false });
  };

  subscribeChat = (chatId: string, onMessage: (msg: ChatMessagePayload) => void): (() => void) => {
    let set = this.chatListenersRef.get(chatId);
    if (!set) {
      set = new Set();
      this.chatListenersRef.set(chatId, set);
    }
    const isNewSubscription = set.size === 0;
    set.add(onMessage);
    if (isNewSubscription) {
      const ws = this.wsRef.current;
      if (ws) this.sendSubscribeChat(ws, chatId);
    }
    return () => {
      set!.delete(onMessage);
      if (set!.size === 0) {
        this.chatListenersRef.delete(chatId);
        this.sendUnsubscribeChat(chatId);
      }
    };
  };

  subscribeMessageDeleted = (chatId: string, onDeleted: (messageId: string) => void): (() => void) => {
    let set = this.messageDeletedListenersRef.get(chatId);
    if (!set) {
      set = new Set();
      this.messageDeletedListenersRef.set(chatId, set);
    }
    set.add(onDeleted);
    return () => {
      set!.delete(onDeleted);
      if (set!.size === 0) this.messageDeletedListenersRef.delete(chatId);
    };
  };

  /** `active: false` — собеседнику сразу убрать «печатает» (без ожидания TTL). */
  sendTyping = (chatId: string, displayName?: string | null, active = true): void => {
    const ok = this.sendJson(
      { type: "typing", chatId, displayName: displayName ?? null, active },
      { queueOnDisconnect: false },
    );
    if (!ok) return;
  };

  subscribeTyping = (
    chatId: string,
    onTyping: (userId: string, displayName: string | null, active: boolean) => void,
  ): (() => void) => {
    let set = this.typingListenersRef.get(chatId);
    if (!set) {
      set = new Set();
      this.typingListenersRef.set(chatId, set);
    }
    set.add(onTyping);
    return () => {
      set!.delete(onTyping);
      if (set!.size === 0) this.typingListenersRef.delete(chatId);
    };
  };

  sendVoiceRecording = (chatId: string, displayName: string | null, recording: boolean): void => {
    const ok = this.sendJson(
      { type: "voice-recording", chatId, displayName, recording },
      { queueOnDisconnect: recording === false },
    );
    if (!ok) return;
  };

  /**
   * Курсор «прочитано до messageId»: сервер принимает только при subscribe-chat-thread (открыт экран диалога).
   * Список чатов шлёт лишь subscribe-chat — без этого статусы не двигаются.
   */
  sendMarkChatRead = (chatId: string, messageId: string): void => {
    if (!chatId || !messageId) return;
    this.sendJson(
      { type: "mark-chat-read", chatId, messageId },
      { dedupeKey: `read:${chatId}:${messageId}`, queueOnDisconnect: true },
    );
  };

  subscribeVoiceRecording = (
    chatId: string,
    onRecording: (userId: string, displayName: string | null, recording: boolean) => void
  ): (() => void) => {
    let set = this.voiceRecordingListenersRef.get(chatId);
    if (!set) {
      set = new Set();
      this.voiceRecordingListenersRef.set(chatId, set);
    }
    set.add(onRecording);
    return () => {
      set!.delete(onRecording);
      if (set!.size === 0) this.voiceRecordingListenersRef.delete(chatId);
    };
  };

  sendComposerPulse = (chatId: string, displayName?: string | null): void => {
    const ok = this.sendJson(
      { type: "composer-pulse", chatId, displayName: displayName ?? null },
      { queueOnDisconnect: false },
    );
    if (!ok) return;
  };

  subscribeComposerPulse = (
    chatId: string,
    onPulse: (userId: string, displayName: string | null, at: number) => void,
  ): (() => void) => {
    let set = this.composerPulseListenersRef.get(chatId);
    if (!set) {
      set = new Set();
      this.composerPulseListenersRef.set(chatId, set);
    }
    set.add(onPulse);
    return () => {
      set!.delete(onPulse);
      if (set!.size === 0) this.composerPulseListenersRef.delete(chatId);
    };
  };

  private attachWsHandlers = (ws: WebSocket): void => {
    ws.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data as string) as RawIncomingMessage;
        if (raw.type === "chat-message" && raw.chatId && raw.message) {
          const set = this.chatListenersRef.get(raw.chatId);
          if (set) set.forEach((cb) => cb(raw.message!));
          return;
        }
        if (raw.type === "message-deleted") {
          const delChatId = raw.chatId;
          const delMessageId = raw.messageId;
          if (typeof delChatId === "string" && typeof delMessageId === "string") {
            const set = this.messageDeletedListenersRef.get(delChatId);
            if (set) set.forEach((cb) => cb(delMessageId));
          }
          return;
        }
        if (raw.type === "chat-list-update") {
          emitChatListUpdate();
          const inc = raw.incomingMessage as { chatId?: string; senderId?: string } | undefined;
          if (typeof inc?.chatId === "string" && typeof inc?.senderId === "string") {
            emitIncomingChatMessageHint({ chatId: inc.chatId, senderId: inc.senderId });
          }
          const gci = raw.groupCallInvite as
            | { chatId?: string; roomId?: string; mediaType?: string; hostUserId?: string; chatTitle?: string | null }
            | undefined;
          if (
            typeof gci?.chatId === "string" &&
            typeof gci?.roomId === "string" &&
            typeof gci?.hostUserId === "string" &&
            (gci.mediaType === "audio" || gci.mediaType === "video")
          ) {
            emitGroupCallInvite({
              chatId: gci.chatId,
              roomId: gci.roomId,
              mediaType: gci.mediaType,
              hostUserId: gci.hostUserId,
              chatTitle: typeof gci.chatTitle === "string" || gci.chatTitle === null ? gci.chatTitle : undefined,
            });
          }
          return;
        }
        if (raw.type === "chat-read" && raw.chatId) {
          emitChatRead({
            chatId: raw.chatId as string,
            readerId: typeof raw.readerId === "string" ? raw.readerId : undefined,
            lastReadAt: typeof raw.lastReadAt === "string" ? raw.lastReadAt : undefined,
          });
          emitChatListUpdate();
          return;
        }
        if (raw.type === "message-reaction" && raw.chatId && typeof raw.messageId === "string") {
          const reactions = Array.isArray(raw.reactions) ? (raw.reactions as { emoji: string; count: number }[]) : [];
          emitMessageReaction({
            chatId: raw.chatId as string,
            messageId: raw.messageId,
            reactions,
            userId: typeof raw.userId === "string" ? raw.userId : "",
            emoji: typeof raw.emoji === "string" ? raw.emoji : null,
          });
          return;
        }
        if (
          raw.type === "message-edited" &&
          raw.chatId &&
          typeof raw.messageId === "string" &&
          typeof raw.content === "string"
        ) {
          emitMessageEdited({
            chatId: raw.chatId as string,
            messageId: raw.messageId,
            content: raw.content,
          });
          return;
        }
        if (raw.type === "chat-vibe-update" && raw.chatId) {
          emitChatVibeUpdate({
            chatId: raw.chatId as string,
            theme: typeof raw.theme === "string" ? raw.theme : "casual",
            confidence: typeof raw.confidence === "number" ? raw.confidence : 0,
            tokens: typeof raw.tokens === "object" && raw.tokens ? (raw.tokens as Record<string, string | number>) : {},
            visualIntensity: typeof raw.visualIntensity === "number" ? raw.visualIntensity : 0,
          });
          return;
        }
        if (raw.type === "chat-vibe-tension-pulse" && raw.chatId && typeof raw.senderId === "string") {
          emitChatVibeTensionPulse({
            chatId: raw.chatId as string,
            senderId: raw.senderId,
            at: typeof raw.at === "number" ? raw.at : Date.now(),
          });
          return;
        }
        if (raw.type === "typing" && raw.chatId && typeof raw.userId === "string") {
          const set = this.typingListenersRef.get(raw.chatId as string);
          const active = raw.active !== false;
          if (set) {
            set.forEach((cb) =>
              cb(raw.userId as string, (raw.displayName as string | null | undefined) ?? null, active),
            );
          }
          return;
        }
        if (raw.type === "composer-pulse" && raw.chatId && typeof raw.userId === "string") {
          const cid = raw.chatId as string;
          const uid = raw.userId as string;
          const dn = (raw.displayName as string | null | undefined) ?? null;
          const at = typeof raw.at === "number" ? raw.at : Date.now();
          const set = this.composerPulseListenersRef.get(cid);
          if (set) set.forEach((cb) => cb(uid, dn, at));
          emitComposerTransferPulse({ chatId: cid, userId: uid, displayName: dn, at });
          return;
        }
        if (raw.type === "voice-recording" && raw.chatId && typeof raw.userId === "string") {
          const set = this.voiceRecordingListenersRef.get(raw.chatId as string);
          if (set) set.forEach((cb) => cb(raw.userId as string, (raw.displayName as string) ?? null, raw.recording === true));
          return;
        }
        this.callMessageHandlerRef.current(raw);
      } catch (e) {
        console.error("[realtime] ws message parse/handle error", e);
      }
    };
    ws.onclose = (event: CloseEvent) => {
      /** Не трогаем ref, если это уже другой сокет — иначе «хвост» старого WS обнуляет активный. */
      if (this.wsRef.current !== ws) return;
      this.notifyLinkState("closed");
      this.wsRef.current = null;
      this.onSocketDisconnectedRef.current();
      const superseded =
        event.code === 4001 &&
        typeof event.reason === "string" &&
        event.reason.includes("superseded_by_new_connection");
      if (superseded) {
        // Избегаем пинг-понга между двумя клиентами одного пользователя:
        // текущий сокет вытеснен новым, поэтому не стартуем мгновенный auto-reconnect.
        console.info("[realtime] /calls socket superseded by newer connection; skip immediate reconnect");
        return;
      }
      this.logCloseReason(event);
      this.scheduleReconnect?.();
    };
    const sendAllChatSubscriptions = () => {
      Array.from(this.chatListenersRef.keys()).forEach((id) => this.sendSubscribeChat(ws, id));
      Array.from(this.threadOpenChatIdsRef).forEach((chatId) => this.sendSubscribeChatThreadPacket(ws, chatId));
      this.flushOutgoingQueue();
    };
    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.reconnectTimestamps = [];
      this.reconnectCircuitOpenUntil = 0;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.notifyLinkState("open");
      sendAllChatSubscriptions();
      this.onSocketConnectedRef.current();
      emitRealtimeSocketConnected();
    };
  };

  private logCloseReason(event: CloseEvent): void {
    const reason = (() => {
      if (event.code === 1000) return "normal";
      if (event.code === 1006) return "abnormal_or_network";
      if (event.code === 1008 || event.code === 4401 || event.code === 4003) return "auth_or_policy";
      if (event.code === 1011) return "server_error";
      return "other";
    })();
    console.warn("[realtime] /calls ws closed", {
      code: event.code,
      reasonText: event.reason || "",
      classifiedReason: reason,
      wasClean: event.wasClean,
    });
  }

  private computeReconnectDelayMs(attempt: number): number {
    const base = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.max(0, attempt - 1));
    const jitter = base * RECONNECT_JITTER_RATIO;
    const withJitter = base - jitter + Math.random() * (jitter * 2);
    return Math.max(350, Math.round(withJitter));
  }

  private openWsWithNewToken = async (jobId?: number): Promise<WebSocket> => {
    const token = await getCallToken();
    const socket = openCallRealtimeWebSocket(token);
    const prev = this.wsRef.current;
    if (prev && prev !== socket) {
      try {
        if (prev.readyState === WebSocket.OPEN || prev.readyState === WebSocket.CONNECTING) {
          prev.close();
        }
      } catch {
        /* ignore */
      }
    }
    this.wsRef.current = socket;
    this.attachWsHandlers(socket);
    await new Promise<void>((resolve, reject) => {
      if (socket.readyState === 1) {
        this.notifyLinkState("open");
        resolve();
        return;
      }
      let settled = false;
      const done = (err: Error | null) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      };
      const t = setTimeout(() => done(new Error("Не удалось подключиться к серверу звонков. Проверьте интернет.")), WS_OPEN_TIMEOUT_MS);
      const prevOnOpen = socket.onopen;
      const prevOnError = socket.onerror;
      const prevOnClose = socket.onclose;
      const safeCall = (fn: unknown, ctx: WebSocket, arg?: Event) => {
        try {
          if (fn != null && typeof fn === "function") (fn as (ev?: Event) => void).call(ctx, arg);
        } catch (e) {
          console.warn("[realtime] ws handler error", e);
        }
      };
      socket.onopen = (ev: Event) => {
        clearTimeout(t);
        safeCall(prevOnOpen, socket, ev);
        done(null);
      };
      socket.onerror = () => {
        clearTimeout(t);
        safeCall(prevOnError, socket);
        done(new Error("Ошибка соединения"));
      };
      socket.onclose = () => {
        clearTimeout(t);
        safeCall(prevOnClose, socket);
        done(new Error("Соединение закрыто"));
      };
    });
    if (jobId != null && this.ensureOpenJobId !== jobId) {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      throw new Error("aborted");
    }
    return socket;
  };

  ensureOpenWs = async (): Promise<WebSocket> => {
    const existing = this.wsRef.current;
    if (existing?.readyState === 1) {
      this.notifyLinkState("open");
      return existing;
    }

    if (!this.wsOpenInflight) {
      const jobId = ++this.ensureOpenJobId;
      this.notifyLinkState("connecting");
      this.wsOpenInflight = (async () => {
        try {
          try {
            return await this.openWsWithNewToken(jobId);
          } catch (firstErr) {
            if (firstErr instanceof Error && firstErr.message === "aborted") throw firstErr;
            const isQuickClose =
              firstErr instanceof Error &&
              (firstErr.message === "Соединение закрыто" || firstErr.message === "Ошибка соединения");
            if (!isQuickClose) throw firstErr;
            this.wsRef.current?.close();
            this.wsRef.current = null;
            return await this.openWsWithNewToken(jobId);
          }
        } finally {
          if (this.ensureOpenJobId === jobId) {
            this.wsOpenInflight = null;
          }
        }
      })();
    }

    return this.wsOpenInflight;
  };

  startBackgroundConnection = (
    userId: string | undefined,
    refetchAuth: () => Promise<unknown>
  ): (() => void) | undefined => {
    if (!userId) return undefined;
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";
    if (pathname === "/login" || pathname.startsWith("/login?")) return undefined;

    let mounted = true;
    const connect = (retryCount = 0) => {
      if (!mounted) return;
      const now = Date.now();
      if (now < this.reconnectCircuitOpenUntil) {
        const remaining = this.reconnectCircuitOpenUntil - now;
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            connect(Math.min(retryCount + 1, BACKGROUND_CONNECT_MAX_RETRIES));
          }, remaining);
        }
        return;
      }
      if (this.wsRef.current?.readyState === 1) return;
      void this.ensureOpenWs().catch((err) => {
        if (!mounted) return;
        const ts = Date.now();
        this.reconnectTimestamps = this.reconnectTimestamps.filter((x) => ts - x <= RECONNECT_WINDOW_MS);
        this.reconnectTimestamps.push(ts);
        if (this.reconnectTimestamps.length >= RECONNECT_WINDOW_LIMIT) {
          this.reconnectCircuitOpenUntil = ts + RECONNECT_CIRCUIT_BREAKER_MS;
          this.reconnectAttempt = 0;
          console.warn("[realtime] reconnect circuit breaker enabled", {
            failuresInWindow: this.reconnectTimestamps.length,
            windowMs: RECONNECT_WINDOW_MS,
            cooldownMs: RECONNECT_CIRCUIT_BREAKER_MS,
          });
          return;
        }
        if (err instanceof CallTokenUnauthorizedError) {
          if (retryCount < BACKGROUND_CONNECT_MAX_RETRIES) {
            const delay = this.computeReconnectDelayMs(this.reconnectAttempt + 1);
            this.reconnectAttempt += 1;
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null;
              connect(retryCount + 1);
            }, delay);
          } else {
            void refetchAuth().catch((e: unknown) => {
              console.warn("[realtime] refetchAuth after call token failures failed", e);
              if (!realtimeRefetchAuthToastShown) {
                realtimeRefetchAuthToastShown = true;
                toast({
                  title: "Не удалось обновить сессию",
                  description: "Проверьте сеть и перезайдите в аккаунт при необходимости.",
                  variant: "destructive",
                });
              }
            });
          }
          return;
        }
        if (retryCount < BACKGROUND_CONNECT_MAX_RETRIES) {
          const delay = this.computeReconnectDelayMs(this.reconnectAttempt + 1);
          this.reconnectAttempt += 1;
          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            connect(retryCount + 1);
          }, delay);
        }
      });
    };

    this.scheduleReconnect = () => {
      if (!mounted || !userId) return;
      if (this.reconnectTimer) return;
      const delay = this.computeReconnectDelayMs(this.reconnectAttempt + 1);
      this.reconnectAttempt += 1;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        connect(0);
      }, delay);
    };
    /** Сразу после входа — иначе call.incoming приходит в пустоту, пока ждали 1.5s. */
    const connectTimer = setTimeout(connect, 0);

    let focusDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const kickReconnectSoon = () => {
      if (focusDebounceTimer) clearTimeout(focusDebounceTimer);
      focusDebounceTimer = setTimeout(() => {
        focusDebounceTimer = null;
        connect(0);
      }, 500);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || !mounted || !userId) return;
      const ws = this.wsRef.current;
      if (!ws || ws.readyState === 2 || ws.readyState === 3) {
        kickReconnectSoon();
        return;
      }
      if (ws.readyState === WebSocket.CONNECTING && this.connectingStartedAt > 0) {
        const age = Date.now() - this.connectingStartedAt;
        if (age >= STUCK_CONNECTING_MS) {
          console.warn("[realtime] ws stuck in CONNECTING after visibility; forcing reconnect", { ageMs: age });
          this.ensureOpenJobId += 1;
          this.wsOpenInflight = null;
          const stuckWs = ws;
          this.wsRef.current = null;
          try {
            stuckWs.close();
          } catch {
            /* ignore */
          }
          this.notifyLinkState("closed");
          kickReconnectSoon();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const onWindowFocus = () => {
      if (document.visibilityState !== "visible" || !mounted || !userId) return;
      onVisibilityChange();
    };
    window.addEventListener("focus", onWindowFocus);

    return () => {
      mounted = false;
      this.scheduleReconnect = null;
      clearTimeout(connectTimer);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
      if (focusDebounceTimer) clearTimeout(focusDebounceTimer);
      this.closeWs();
    };
  };
}
