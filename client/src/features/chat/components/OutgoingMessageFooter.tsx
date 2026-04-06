/**
 * Футер исходящего: время + статус доставки/прочтения (иконки и доступность).
 */
import { Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiMessage } from "../types";
import {
  formatMessageTime,
  isOutgoingMessageReadByPeer,
  outgoingDeliveryAriaLabel,
  outgoingDeliveryTitle,
} from "../utils/format";

export type OutgoingMessageFooterProps = {
  msg: ApiMessage;
  lastReadAt: string | null;
  vibeTextBubble: boolean;
  pulseTextShell: boolean;
  pulseMobileDm: "dark" | "light" | null | undefined;
  onRetry: (msg: ApiMessage) => void;
};

export function OutgoingMessageFooter({
  msg,
  lastReadAt,
  vibeTextBubble,
  pulseTextShell,
  pulseMobileDm,
  onRetry,
}: OutgoingMessageFooterProps) {
  if (msg.sendStatus === "sending") {
    return (
      <span className="inline-flex items-center gap-1" title="Отправляется" aria-label="Отправляется">
        <Clock className="h-3.5 w-3.5 flex-shrink-0 animate-pulse" aria-hidden />
        <span className="text-[10px] font-medium tracking-tight opacity-90" aria-hidden>
          Отправляется
        </span>
      </span>
    );
  }
  if (msg.sendStatus === "failed") {
    return (
      <span className="inline-flex items-center gap-1" role="status" aria-label="Ошибка отправки">
        <span title="Ошибка отправки">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
        </span>
        <button
          type="button"
          className="text-[10px] font-medium underline underline-offset-1 hover:opacity-100 opacity-90"
          aria-label="Повторить отправку сообщения"
          onClick={(e) => {
            e.stopPropagation();
            onRetry(msg);
          }}
        >
          Повторить
        </button>
      </span>
    );
  }

  const isRead = isOutgoingMessageReadByPeer(msg.createdAt, lastReadAt);
  const title = outgoingDeliveryTitle(isRead, lastReadAt, msg.sendStatus);
  const checksAria = outgoingDeliveryAriaLabel(isRead, lastReadAt, msg.sendStatus);
  const timeStr = formatMessageTime(msg.createdAt);
  const fullAria = `${timeStr}, ${checksAria}`;

  const checkGlow = vibeTextBubble
    ? "drop-shadow-[0_0_4px_rgba(255,255,255,0.45)]"
    : pulseTextShell && pulseMobileDm === "dark"
      ? "drop-shadow-[0_0_5px_rgba(165,180,252,0.55)]"
      : pulseTextShell && pulseMobileDm === "light"
        ? "drop-shadow-[0_0_5px_rgba(99,102,241,0.45)]"
        : "drop-shadow-[0_0_5px_hsl(var(--primary)/0.6)]";

  return (
    <span className="inline-flex items-center gap-0.5" title={title} aria-label={fullAria}>
      <span aria-hidden="true">{timeStr}</span>
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        <span
          className={cn(
            "inline-flex items-center gap-0.5",
            isRead &&
              (vibeTextBubble
                ? "text-white"
                : pulseTextShell && pulseMobileDm === "dark"
                  ? "text-indigo-200"
                  : pulseTextShell && pulseMobileDm === "light"
                    ? "text-white"
                    : "text-primary"),
          )}
        >
          <svg
            className={cn("w-3 h-3 flex-shrink-0", isRead && checkGlow)}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {isRead && (
            <svg
              className={cn("w-3 h-3 flex-shrink-0 -ml-2.25", checkGlow)}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
      </span>
    </span>
  );
}
