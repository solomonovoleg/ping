import type { PingokMicroParseResponse } from "@shared/pingok-micro/command-types";
import { storage } from "../storage";
import { sendChatMessage, MessagesServiceError } from "../messages/service";
import {
  parseRussianReminderTime,
  extractTaskTitle,
  extractCallTaskTitle,
  parseVoiceDmCommand,
  parseVoiceCallCommand,
} from "./time-parse";
import { findMessageUserCandidates, type MessageUserCandidate } from "./user-candidate-search";

export type PingokExecuteCandidate = MessageUserCandidate;

export type PingokExecuteResponse =
  | {
      ok: true;
      reply: string;
      reminderId?: string;
      taskId?: string;
      chatId?: string;
      callMode?: "audio" | "video";
      targetUserId?: string;
      targetDisplayName?: string;
    }
  | {
      ok: false;
      reply: string;
      code?: "need_time" | "pick_user" | "parse_message" | "confirm_user" | "confirm_call_user" | "pick_call_user";
      candidates?: PingokExecuteCandidate[];
      pendingMessage?: string;
      pendingCallMode?: "audio" | "video";
    };

function personLabel(c: PingokExecuteCandidate): string {
  return [c.displayName, c.surname].filter(Boolean).join(" ").trim() || "Пользователь";
}

function looksLikeScheduledCall(text: string): boolean {
  const s = text.toLowerCase();
  return /(?:запланиру|план|напомни|напомин|через\s+\d+|завтра|сегодня|послезавтра|(?:^|\s)(?:в|на|к)\s+\d{1,2}(?:[.:]\d{2})?(?=\s|$)|\d{1,2}:\d{2})/i.test(
    s,
  );
}

export async function executePingokCommand(
  userId: string,
  parsed: PingokMicroParseResponse,
  now: Date = new Date(),
): Promise<PingokExecuteResponse> {
  const text = parsed.commandText?.trim() || "";
  const intent = parsed.intent;

  if (intent === "remind" || intent === "plan") {
    const r = parseRussianReminderTime(text, now);
    if ("error" in r) return { ok: false, reply: r.error, code: "need_time" };
    if (r.fireAt.getTime() <= now.getTime() - 5_000) {
      return { ok: false, reply: "Время напоминания уже в прошлом. Уточните, пожалуйста.", code: "need_time" };
    }
    const row = await storage.createUserReminder({
      userId,
      title: r.title,
      fireAt: r.fireAt,
    });
    const when = r.fireAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
    const kind = intent === "plan" ? "Событие в плане" : "Напоминание";
    return { ok: true, reply: `${kind}: «${row.title}» на ${when}.`, reminderId: row.id };
  }

  if (intent === "task") {
    const title = extractTaskTitle(text);
    const row = await storage.createVoiceTask({ userId, title });
    return { ok: true, reply: `Задача добавлена: «${row.title}».`, taskId: row.id };
  }

  if (intent === "call") {
    if (looksLikeScheduledCall(text)) {
      const parsedTime = parseRussianReminderTime(text, now);
      if ("error" in parsedTime) {
        const title = extractCallTaskTitle(text);
        const row = await storage.createVoiceTask({ userId, title });
        return {
          ok: true,
          reply: `Время звонка не распознал, но задачу добавил: «${row.title}». Уточните время командой «напомни ...».`,
          taskId: row.id,
        };
      }
      if (parsedTime.fireAt.getTime() <= now.getTime() - 5_000) {
        return { ok: false, reply: "Время звонка уже в прошлом. Уточните, пожалуйста.", code: "need_time" };
      }
      const cleanedCallTarget = parsedTime.title
        .replace(/^(?:позвони(?:ть)?|набери|перезвони(?:ть)?|созвон(?:иться)?)(?:\s+с)?\s*/i, "")
        .trim();
      const title = cleanedCallTarget ? `Позвонить ${cleanedCallTarget}` : "Позвонить";
      const row = await storage.createUserReminder({
        userId,
        title,
        fireAt: parsedTime.fireAt,
      });
      const when = parsedTime.fireAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
      return {
        ok: true,
        reply: `Звонок запланирован: «${row.title}» на ${when}.`,
        reminderId: row.id,
      };
    }

    const call = parseVoiceCallCommand(text);
    if ("error" in call) return { ok: false, reply: call.error, code: "parse_message" };
    const candidates = await findMessageUserCandidates(userId, call.nameQuery);
    if (candidates.length === 0) {
      return {
        ok: false,
        reply:
          `Не нашёл пользователя «${call.nameQuery}». ` +
          "Попробуйте назвать имя точнее, ник, номер профиля или телефон.",
      };
    }
    if (candidates.length === 1) {
      const one = candidates[0]!;
      return {
        ok: false,
        code: "confirm_call_user",
        reply: `${call.media === "video" ? "Видео" : "Аудио"} звонок: подтвердите ${personLabel(one)}. Скажите «да» или «нет».`,
        candidates: [one],
        pendingCallMode: call.media,
      };
    }
    const listed = candidates
      .slice(0, 3)
      .map((c, i) => `${i + 1}) ${personLabel(c)}`)
      .join(" · ");
    return {
      ok: false,
      code: "pick_call_user",
      reply: `Нашёл несколько контактов для звонка: ${listed}. Скажите имя или номер.`,
      candidates,
      pendingCallMode: call.media,
    };
  }

  if (intent === "message") {
    const dm = parseVoiceDmCommand(text);
    if ("error" in dm) return { ok: false, reply: dm.error, code: "parse_message" };
    if (!dm.messageText.trim()) {
      return { ok: false, reply: "Добавьте текст сообщения после «что …».", code: "parse_message" };
    }

    const candidates = await findMessageUserCandidates(userId, dm.nameQuery);
    if (candidates.length === 0) {
      return {
        ok: false,
        reply:
          `Не нашёл пользователя «${dm.nameQuery}». ` +
          "Попробуйте назвать имя точнее, ник, номер профиля или телефон.",
      };
    }
    if (candidates.length === 1) {
      const one = candidates[0]!;
      return {
        ok: false,
        code: "confirm_user",
        reply: `Вы имели в виду ${personLabel(one)}? Скажите «да» или «нет».`,
        candidates: [one],
        pendingMessage: dm.messageText,
      };
    }
    const listed = candidates
      .slice(0, 3)
      .map((c, i) => `${i + 1}) ${personLabel(c)}`)
      .join(" · ");
    return {
      ok: false,
      code: "pick_user",
      reply: `Нашёл несколько вариантов: ${listed}. Скажите имя или номер.`,
      candidates,
      pendingMessage: dm.messageText,
    };
  }

  return { ok: false, reply: "Эта команда выполняется другим способом (поиск или лента)." };
}

export async function startCallWithUser(
  callerId: string,
  targetUserId: string,
  media: "audio" | "video",
): Promise<PingokExecuteResponse> {
  if (targetUserId === callerId) return { ok: false, reply: "Нельзя звонить самому себе этим способом." };
  try {
    const chat = await storage.getOrCreateDmChat(callerId, targetUserId);
    const peer = await storage.getUser(targetUserId);
    const label = [peer?.displayName, peer?.surname].filter(Boolean).join(" ").trim() || "контакту";
    return {
      ok: true,
      reply: `${media === "video" ? "Видео" : "Аудио"} звонок запускаю: ${label}.`,
      chatId: chat.id,
      callMode: media,
      targetUserId,
      targetDisplayName: label,
    };
  } catch (e) {
    console.error("[pingok-micro] startCallWithUser", e);
    return { ok: false, reply: "Не удалось подготовить звонок." };
  }
}

export async function sendDmToUser(
  senderId: string,
  targetUserId: string,
  messageText: string,
): Promise<PingokExecuteResponse> {
  if (targetUserId === senderId) return { ok: false, reply: "Нельзя отправить сообщение самому себе таким способом." };
  try {
    const chat = await storage.getOrCreateDmChat(senderId, targetUserId);
    await sendChatMessage({
      userId: senderId,
      chatId: chat.id,
      content: messageText.trim(),
      type: "text",
    });
    const peer = await storage.getUser(targetUserId);
    const label = [peer?.displayName, peer?.surname].filter(Boolean).join(" ").trim() || "контакту";
    return { ok: true, reply: `Сообщение отправлено: ${label}.`, chatId: chat.id };
  } catch (e) {
    if (e instanceof MessagesServiceError) return { ok: false, reply: e.message };
    console.error("[pingok-micro] sendDmToUser", e);
    return { ok: false, reply: "Не удалось отправить сообщение." };
  }
}
