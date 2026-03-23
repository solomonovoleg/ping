import type { PingokExecuteResponse } from "@pingok-micro/pingok-micro-api";

export type PingokSuccessFlightPayload = {
  id: string;
  variant: "message" | "scheduled_call" | "task" | "reminder";
  line1: string;
  line2?: string;
  target: "chats" | "board";
};

function randomId(): string {
  return `pf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function headLine(s: string, max = 100): string {
  const t = s.trim();
  if (!t) return "";
  const one = t.split(/(?<=[.!?])\s+/)[0] ?? t;
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

/**
 * Строит пейлоад «улетающей» плашки по ответу execute/send-dm/schedule.
 * null — например, сразу открыли звонок (полноэкранный сценарий).
 */
export function pingokSuccessPayloadFromExecute(
  ex: Extract<PingokExecuteResponse, { ok: true }>,
  opts?: { messageBody?: string },
): PingokSuccessFlightPayload | null {
  if (ex.callMode && ex.chatId && ex.targetUserId) {
    return null;
  }

  const reply = ex.reply.trim();
  const body = opts?.messageBody?.trim();

  if (body && ex.chatId) {
    const peerMatch = /^Сообщение отправлено:\s*(.+?)\.?$/i.exec(reply);
    const peer = peerMatch?.[1]?.trim() || "Диалог";
    return {
      id: randomId(),
      variant: "message",
      line1: peer,
      line2: body.slice(0, 280),
      target: "chats",
    };
  }

  if (ex.taskId) {
    return {
      id: randomId(),
      variant: "task",
      line1: headLine(reply) || "Задача сохранена",
      target: "board",
    };
  }

  if (ex.reminderId && (ex.chatId || /звонок/i.test(reply))) {
    return {
      id: randomId(),
      variant: "scheduled_call",
      line1: headLine(reply) || "Звонок запланирован",
      target: "chats",
    };
  }

  if (ex.reminderId) {
    return {
      id: randomId(),
      variant: "reminder",
      line1: headLine(reply) || "Напоминание",
      target: "board",
    };
  }

  if (ex.chatId) {
    return {
      id: randomId(),
      variant: "message",
      line1: "Готово",
      line2: headLine(reply, 220),
      target: "chats",
    };
  }

  // Отмена / перенос созвона и прочие ok только с текстом (без id в JSON).
  if (reply.length >= 3) {
    const toChats = /звонок|перенес|перенёс|отмен/i.test(reply);
    return {
      id: randomId(),
      variant: toChats ? "scheduled_call" : "reminder",
      line1: headLine(reply) || "Готово",
      target: toChats ? "chats" : "board",
    };
  }

  return null;
}
