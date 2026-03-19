import type { MutableRefObject } from "react";
import { getCallToken, getCallWsUrl, CallTokenUnauthorizedError } from "@/lib/calls";
import {
  emitChatListUpdate,
  emitChatRead,
  emitMessageEdited,
  emitMessageReaction,
  emitChatVibeUpdate,
} from "@/features/chat/realtime-events";

export type ChatMessagePayload = {
  id: string;
  chatId: string;
  senderId: string | null;
  type: string;
  content: string;
  createdAt: string;
  translatedText?: string;
  detectedLang?: string;
};

type RawIncomingMessage = Record<string, unknown> & {
  type?: string;
  chatId?: string;
  message?: ChatMessagePayload;
  fromUserId?: string;
  fromDisplayName?: string;
};

type TransportParams = {
  wsRef: MutableRefObject<WebSocket | null>;
  callMessageHandlerRef: MutableRefObject<(raw: Record<string, unknown>) => void>;
  onSocketDisconnectedRef: MutableRefObject<() => void>;
};

type SendJsonOptions = {
  queueOnDisconnect?: boolean;
  dedupeKey?: string;
};

const WS_OPEN_TIMEOUT_MS = 12000;
const BACKGROUND_CONNECT_MAX_RETRIES = 5;
const OUTGOING_QUEUE_MAX = 300;
const OUTGOING_QUEUE_TTL_MS = 30_000;

type QueuedOutgoingItem = {
  payload: string;
  dedupeKey?: string;
  queuedAt: number;
};

export class RealtimeSocketTransport {
  private readonly wsRef: MutableRefObject<WebSocket | null>;
  private readonly callMessageHandlerRef: MutableRefObject<(raw: Record<string, unknown>) => void>;
  private readonly onSocketDisconnectedRef: MutableRefObject<() => void>;
  private readonly chatListenersRef = new Map<string, Set<(msg: ChatMessagePayload) => void>>();
  private readonly messageDeletedListenersRef = new Map<string, Set<(messageId: string) => void>>();
  private readonly typingListenersRef = new Map<string, Set<(userId: string, displayName: string | null) => void>>();
  private readonly voiceRecordingListenersRef = new Map<
    string,
    Set<(userId: string, displayName: string | null, recording: boolean) => void>
  >();
  private scheduleReconnect: (() => void) | null = null;
  private outgoingQueue: QueuedOutgoingItem[] = [];

  constructor(params: TransportParams) {
    this.wsRef = params.wsRef;
    this.callMessageHandlerRef = params.callMessageHandlerRef;
    this.onSocketDisconnectedRef = params.onSocketDisconnectedRef;
  }

  closeWs = (): void => {
    this.wsRef.current?.close();
    this.wsRef.current = null;
    this.outgoingQueue = [];
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

  sendTyping = (chatId: string, displayName?: string | null): void => {
    const ok = this.sendJson({ type: "typing", chatId, displayName: displayName ?? null }, { queueOnDisconnect: false });
    if (!ok) return;
  };

  subscribeTyping = (chatId: string, onTyping: (userId: string, displayName: string | null) => void): (() => void) => {
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
      { queueOnDisconnect: false }
    );
    if (!ok) return;
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
          return;
        }
        if (raw.type === "chat-read" && raw.chatId && raw.lastReadAt) {
          emitChatRead({
            chatId: raw.chatId,
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
        if (raw.type === "typing" && raw.chatId && typeof raw.userId === "string") {
          const set = this.typingListenersRef.get(raw.chatId as string);
          if (set) set.forEach((cb) => cb(raw.userId as string, (raw.displayName as string) ?? null));
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
    ws.onclose = () => {
      this.wsRef.current = null;
      this.onSocketDisconnectedRef.current();
      this.scheduleReconnect?.();
    };
    const sendAllChatSubscriptions = () => {
      Array.from(this.chatListenersRef.keys()).forEach((id) => this.sendSubscribeChat(ws, id));
      this.flushOutgoingQueue();
    };
    ws.onopen = () => sendAllChatSubscriptions();
  };

  ensureOpenWs = async (): Promise<WebSocket> => {
    const existing = this.wsRef.current;
    if (existing?.readyState === 1) return existing;

    const openWsWithNewToken = async (): Promise<WebSocket> => {
      const token = await getCallToken();
      const socket = new WebSocket(getCallWsUrl(token));
      this.wsRef.current = socket;
      this.attachWsHandlers(socket);
      await new Promise<void>((resolve, reject) => {
        if (socket.readyState === 1) {
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
      return socket;
    };

    try {
      return await openWsWithNewToken();
    } catch (firstErr) {
      const isQuickClose =
        firstErr instanceof Error &&
        (firstErr.message === "Соединение закрыто" || firstErr.message === "Ошибка соединения");
      if (!isQuickClose) throw firstErr;
      this.wsRef.current?.close();
      this.wsRef.current = null;
      return openWsWithNewToken();
    }
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
      if (this.wsRef.current?.readyState === 1) return;
      getCallToken()
        .then((token) => {
          if (!mounted) return;
          if (this.wsRef.current?.readyState === 1) return;
          const ws = new WebSocket(getCallWsUrl(token));
          this.wsRef.current = ws;
          this.attachWsHandlers(ws);
        })
        .catch((err) => {
          if (!mounted) return;
          if (err instanceof CallTokenUnauthorizedError) {
            if (retryCount < BACKGROUND_CONNECT_MAX_RETRIES) {
              setTimeout(() => connect(retryCount + 1), 1200 * (retryCount + 1));
            } else {
              refetchAuth().catch(() => {});
            }
            return;
          }
          if (retryCount < BACKGROUND_CONNECT_MAX_RETRIES) {
            setTimeout(() => connect(retryCount + 1), 1000 * (retryCount + 1));
          }
        });
    };

    this.scheduleReconnect = () => {
      if (!mounted || !userId) return;
      setTimeout(() => connect(0), 2000);
    };
    const connectTimer = setTimeout(connect, 1500);

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || !mounted || !userId) return;
      const ws = this.wsRef.current;
      if (!ws || ws.readyState === 2 || ws.readyState === 3) {
        setTimeout(() => connect(0), 500);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mounted = false;
      this.scheduleReconnect = null;
      clearTimeout(connectTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      this.closeWs();
    };
  };
}
