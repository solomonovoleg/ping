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
    const queueable = event.type === "call.invite" ||
      event.type === "call.accept" ||
      event.type === "call.reject" ||
      event.type === "call.cancel" ||
      event.type === "call.hangup";

    this.sendJson(event as unknown as Record<string, unknown>, {
      queueOnDisconnect: queueable,
      dedupeKey: queueable ? `${event.type}:${event.callId}` : undefined,
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
