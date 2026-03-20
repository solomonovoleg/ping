import { useRef, useEffect, type MutableRefObject } from "react";
import { RealtimeSocketTransport } from "@/lib/realtime-socket-transport";

export type { ChatMessagePayload } from "@/lib/realtime-socket-transport";

export type UseRealtimeSocketOptions = {
  userId: string | undefined;
  refetchAuth: () => Promise<unknown>;
  /** Обрабатывает WS-сообщения, не относящиеся к чату (в т.ч. сигналинг звонков). */
  callMessageHandlerRef: MutableRefObject<(raw: Record<string, unknown>) => void>;
  /** Сокет закрыт (обрыв сети и т.д.) — до scheduleReconnect. */
  onSocketDisconnectedRef: MutableRefObject<() => void>;
  /** Сокет снова открыт после реконнекта. */
  onSocketConnectedRef: MutableRefObject<() => void>;
};

/**
 * Один WebSocket: real-time чат (подписки, typing, voice-recording) + делегирование остального в callMessageHandlerRef.
 */
export function useRealtimeSocket({
  userId,
  refetchAuth,
  callMessageHandlerRef,
  onSocketDisconnectedRef,
  onSocketConnectedRef,
}: UseRealtimeSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const transportRef = useRef<RealtimeSocketTransport | null>(null);
  if (!transportRef.current) {
    transportRef.current = new RealtimeSocketTransport({
      wsRef,
      callMessageHandlerRef,
      onSocketDisconnectedRef,
      onSocketConnectedRef,
    });
  }
  const transport = transportRef.current;

  useEffect(() => {
    return transport.startBackgroundConnection(userId, refetchAuth);
  }, [transport, userId, refetchAuth]);

  return {
    wsRef,
    ensureOpenWs: transport.ensureOpenWs,
    closeWs: transport.closeWs,
    sendJson: transport.sendJson,
    subscribeChat: transport.subscribeChat,
    subscribeMessageDeleted: transport.subscribeMessageDeleted,
    sendTyping: transport.sendTyping,
    subscribeTyping: transport.subscribeTyping,
    sendVoiceRecording: transport.sendVoiceRecording,
    subscribeVoiceRecording: transport.subscribeVoiceRecording,
  };
}
