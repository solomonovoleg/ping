import type { ClientCallEvent, ServerCallEvent } from "./call-types";

type SendJsonFn = (
  data: Record<string, unknown>,
  opts?: { queueOnDisconnect?: boolean; dedupeKey?: string },
) => boolean;

type SignalListener = (event: ServerCallEvent) => void;

/**
 * Call signaling client.
 * Sends ClientCallEvent through the shared WebSocket transport
 * and dispatches incoming ServerCallEvent to a listener.
 */
export class CallSignalingClient {
  private listener: SignalListener | null = null;

  constructor(private sendJson: SendJsonFn) {}

  /** Replace the sendJson function (e.g. after transport reconnect). */
  updateTransport(sendJson: SendJsonFn): void {
    this.sendJson = sendJson;
  }

  /** Send a client call event to the server. */
  send(event: ClientCallEvent): void {
    const t = event.type;
    const queueable =
      t === "call.invite" ||
      t === "call.accept" ||
      t === "call.reject" ||
      t === "call.cancel" ||
      t === "call.hangup" ||
      t === "call.resume-check" ||
      t === "call.resume-request" ||
      t === "call.offer" ||
      t === "call.answer" ||
      t === "call.ice-candidate" ||
      /** Каждая строка отдельно — dedupe не используем, иначе съедутся при очереди. */
      t === "call.caption";

    let dedupeKey: string | undefined;
    if (queueable) {
      if (t === "call.ice-candidate" || t === "call.caption") {
        dedupeKey = undefined;
      } else if ("callId" in event && typeof event.callId === "string") {
        dedupeKey = `${t}:${event.callId}`;
      } else {
        dedupeKey = t;
      }
    }

    this.sendJson(event as unknown as Record<string, unknown>, {
      queueOnDisconnect: queueable,
      dedupeKey,
    });
  }

  /** Set the listener for incoming server events. Only one listener at a time. */
  onEvent(listener: SignalListener): () => void {
    this.listener = listener;
    return () => {
      if (this.listener === listener) this.listener = null;
    };
  }

  /**
   * Feed a raw WS message into the signaling client.
   * Returns true if the message was a call event and was handled.
   */
  handleRawMessage(raw: Record<string, unknown>): boolean {
    const type = raw.type;
    if (typeof type !== "string" || !type.startsWith("call.")) return false;
    if (this.listener) {
      this.listener(raw as unknown as ServerCallEvent);
    }
    return true;
  }
}
