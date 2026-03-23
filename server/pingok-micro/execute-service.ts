import type { PingokMicroParseResponse } from "@pingok-micro-shared/command-types";
import { storage } from "../storage";
import { sendChatMessage, MessagesServiceError } from "../messages/service";
import {
  parseRussianReminderTime,
  extractTaskTitle,
  extractCallTaskTitle,
  parseVoiceDmCommand,
  parseVoiceCallCommand,
  parseVoiceTrackTaskCommand,
  looksLikeVoiceCallReschedule,
  looksLikeVoiceCallCancel,
  parseVoiceCallRescheduleFragment,
  parseVoiceCallCancelNameQuery,
} from "./time-parse";
import {
  findMessageUserCandidates,
  type MessageUserCandidate,
  type MessageUserCandidateRanked,
} from "./user-candidate-search";
import { notifyChatListUpdate } from "../calls/ws";

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
      code?:
        | "need_time"
        | "pick_user"
        | "parse_message"
        | "confirm_user"
        | "confirm_call_user"
        | "pick_call_user"
        | "pick_schedule_call_peer";
      candidates?: PingokExecuteCandidate[];
      pendingMessage?: string;
      pendingCallMode?: "audio" | "video";
      pendingScheduleFireAt?: string;
      pendingScheduleReminderTitle?: string;
    };

function personLabel(c: PingokExecuteCandidate): string {
  return [c.displayName, c.surname].filter(Boolean).join(" ").trim() || "Пользователь";
}

/** Не отдаём вес ранжирования на клиент (лишнее поле + не API-контракт). */
function stripCandidateScores(c: MessageUserCandidateRanked[]): PingokExecuteCandidate[] {
  return c.map(({ matchScore: _s, ...rest }) => rest);
}

/**
 * Если лидер по сумме баллов заметно выше второго — не заставляем выбирать из списка
 * (типичный кейс: «Илоне» vs «Елена» при близких результатах поиска).
 */
function collapseIfClearWinner(candidates: MessageUserCandidateRanked[]): MessageUserCandidateRanked[] {
  if (candidates.length <= 1) return candidates;
  const gap = candidates[0]!.matchScore - candidates[1]!.matchScore;
  const MIN_GAP = 26;
  if (gap >= MIN_GAP) return [candidates[0]!];
  return candidates;
}

function looksLikeScheduledCall(text: string): boolean {
  const s = text.toLowerCase();
  if (looksLikeVoiceCallReschedule(text) || looksLikeVoiceCallCancel(text)) return false;
  return /(?:запланиру|план|напомни|напомин|через\s+\d+|завтра|сегодня|послезавтра|(?:^|\s)(?:в|на|к)\s+\d{1,2}(?:[.:]\d{2})?(?=\s|$)|\d{1,2}:\d{2})/i.test(
    s,
  );
}

async function pickPlannerScheduleRow(
  userId: string,
  nameQuery: string | null,
): Promise<{ id: string; chatId: string; peerUserId: string; plannerReminderId: string | null } | null> {
  const rows = await storage.listPlannerActiveDmScheduledCalls(userId);
  if (rows.length === 0) return null;
  if (!nameQuery?.trim()) return rows[0]!;
  const cand = await findMessageUserCandidates(userId, nameQuery.trim());
  if (cand.length === 0) return rows[0]!;
  const ids = new Set(cand.map((c) => c.id));
  const hit = rows.find((r) => ids.has(r.peerUserId));
  return hit ?? rows[0]!;
}

function bumpDmScheduleChatList(userId: string, chatId: string, peerUserId: string): void {
  const bump = { incomingMessage: { chatId, senderId: userId } };
  notifyChatListUpdate(userId, bump);
  notifyChatListUpdate(peerUserId, bump);
}

/** Строка в ленте чата: видна обоим, дополняет баннер в шапке. */
async function postScheduledCallChatNotice(
  plannerUserId: string,
  chatId: string,
  fireAt: Date,
  reminderTitle: string,
): Promise<void> {
  const when = fireAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
  try {
    await sendChatMessage({
      userId: plannerUserId,
      chatId,
      type: "system",
      content: `Запланирован звонок: «${reminderTitle}» · ${when}`,
    });
  } catch (e) {
    console.warn("[pingok-micro] scheduled call chat notice", e);
  }
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
    const trackCmd = parseVoiceTrackTaskCommand(text);
    if (trackCmd) {
      const track = await storage.findBestUserTrackByName(userId, trackCmd.trackName);
      if (!track) {
        return {
          ok: false,
          reply: `Не нашёл трек «${trackCmd.trackName}». Создайте трек на доске или скажите название точнее.`,
        };
      }
      try {
        const srcChat = await storage.ensurePingokTrackSourceChat(userId);
        const msg = await sendChatMessage({
          userId,
          chatId: srcChat.id,
          content: trackCmd.itemText.trim(),
          type: "text",
        });
        await storage.addMessageToTrack(userId, track.id, msg.id, srcChat.id);
        return {
          ok: true,
          reply: `Записал в трек «${track.name}»: «${trackCmd.itemText.trim()}».`,
          taskId: msg.id,
        };
      } catch (e) {
        if (e instanceof MessagesServiceError) return { ok: false, reply: e.message };
        console.error("[pingok-micro] track task", e);
        return { ok: false, reply: "Не удалось записать в трек." };
      }
    }
    const title = extractTaskTitle(text);
    const row = await storage.createVoiceTask({ userId, title });
    return { ok: true, reply: `Задача добавлена: «${row.title}».`, taskId: row.id };
  }

  if (intent === "call") {
    if (looksLikeVoiceCallCancel(text)) {
      const nameQ = parseVoiceCallCancelNameQuery(text);
      const picked = await pickPlannerScheduleRow(userId, nameQ);
      if (!picked) {
        return {
          ok: false,
          reply: "Нет активного запланированного звонка, который можно отменить.",
        };
      }
      const meta = await storage.cancelDmScheduledCallAsPlanner(userId, picked.id);
      if (!meta) {
        return { ok: false, reply: "Не удалось отменить план звонка." };
      }
      bumpDmScheduleChatList(userId, meta.chatId, meta.peerUserId);
      return { ok: true, reply: "Запланированный звонок отменён. Собеседнику баннер тоже скроется." };
    }

    if (looksLikeVoiceCallReschedule(text)) {
      const frag = parseVoiceCallRescheduleFragment(text);
      if ("error" in frag) return { ok: false, reply: frag.error, code: "need_time" };
      const t = parseRussianReminderTime(frag.timePhrase, now);
      if ("error" in t) return { ok: false, reply: t.error, code: "need_time" };
      if (t.fireAt.getTime() <= now.getTime() - 5_000) {
        return { ok: false, reply: "Новое время уже в прошлом. Уточните, пожалуйста.", code: "need_time" };
      }
      const picked = await pickPlannerScheduleRow(userId, frag.nameQuery);
      if (!picked) {
        return {
          ok: false,
          reply: "Нет активного запланированного звонка. Сначала запланируйте: «позвони … через час».",
        };
      }
      const when = t.fireAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
      const newTitle = `Звонок · ${when}`;
      const meta = await storage.updateDmScheduledCallFireAsPlanner(userId, picked.id, t.fireAt, newTitle);
      if (!meta) {
        return { ok: false, reply: "Не удалось перенести звонок." };
      }
      bumpDmScheduleChatList(userId, meta.chatId, meta.peerUserId);
      return { ok: true, reply: `Перенёс звонок на ${when}.` };
    }

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
      const reminderTitle = cleanedCallTarget ? `Позвонить ${cleanedCallTarget}` : "Позвонить";
      const when = parsedTime.fireAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });

      if (!cleanedCallTarget) {
        const row = await storage.createUserReminder({
          userId,
          title: reminderTitle,
          fireAt: parsedTime.fireAt,
        });
        return {
          ok: true,
          reply: `Звонок запланирован: «${row.title}» на ${when}.`,
          reminderId: row.id,
        };
      }

      let cand = await findMessageUserCandidates(userId, cleanedCallTarget);
      cand = collapseIfClearWinner(cand);
      if (cand.length === 0) {
        const row = await storage.createUserReminder({
          userId,
          title: reminderTitle,
          fireAt: parsedTime.fireAt,
        });
        return {
          ok: true,
          reply: `Звонок запланирован: «${row.title}» на ${when}. Контакт не сопоставил — баннер в чате не создан, напоминание осталось.`,
          reminderId: row.id,
        };
      }
      if (cand.length > 1) {
        const listed = cand
          .slice(0, 3)
          .map((c, i) => `${i + 1}) ${personLabel(c)}`)
          .join(" · ");
        return {
          ok: false,
          code: "pick_schedule_call_peer",
          reply: `Несколько подходящих контактов: ${listed}. Выберите, кому планируем звонок.`,
          candidates: stripCandidateScores(cand),
          pendingScheduleFireAt: parsedTime.fireAt.toISOString(),
          pendingScheduleReminderTitle: reminderTitle,
        };
      }

      const peer = cand[0]!;
      const row = await storage.createUserReminder({
        userId,
        title: reminderTitle,
        fireAt: parsedTime.fireAt,
      });
      let scheduledChatId: string | undefined;
      try {
        const dm = await storage.getOrCreateDmChat(userId, peer.id);
        scheduledChatId = dm.id;
        await storage.createDmScheduledCall({
          chatId: dm.id,
          createdByUserId: userId,
          peerUserId: peer.id,
          fireAt: parsedTime.fireAt,
          title: `Звонок · ${when}`,
          plannerReminderId: row.id,
        });
        await postScheduledCallChatNotice(userId, dm.id, parsedTime.fireAt, row.title);
        bumpDmScheduleChatList(userId, dm.id, peer.id);
      } catch (e) {
        console.warn("[pingok-micro] dm_scheduled_call side effect", e);
      }
      return {
        ok: true,
        reply: `Звонок запланирован: «${row.title}» на ${when}.`,
        reminderId: row.id,
        ...(scheduledChatId ? { chatId: scheduledChatId } : {}),
      };
    }

    const call = parseVoiceCallCommand(text);
    if ("error" in call) return { ok: false, reply: call.error, code: "parse_message" };
    let candidates = await findMessageUserCandidates(userId, call.nameQuery);
    candidates = collapseIfClearWinner(candidates);
    if (candidates.length === 0) {
      return {
        ok: false,
        reply:
          `Не нашёл пользователя «${call.nameQuery}». ` +
          "Попробуйте назвать имя точнее, ник, номер профиля или телефон.",
      };
    }
    if (candidates.length === 1) {
      const one = stripCandidateScores([candidates[0]!])[0]!;
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
      candidates: stripCandidateScores(candidates),
      pendingCallMode: call.media,
    };
  }

  if (intent === "message") {
    const dm = parseVoiceDmCommand(text);
    if ("error" in dm) return { ok: false, reply: dm.error, code: "parse_message" };
    if (!dm.messageText.trim()) {
      return { ok: false, reply: "Добавьте текст сообщения после «что …».", code: "parse_message" };
    }

    let candidates = await findMessageUserCandidates(userId, dm.nameQuery);
    candidates = collapseIfClearWinner(candidates);
    if (candidates.length === 0) {
      return {
        ok: false,
        reply:
          `Не нашёл пользователя «${dm.nameQuery}». ` +
          "Попробуйте назвать имя точнее, ник, номер профиля или телефон.",
      };
    }
    if (candidates.length === 1) {
      const one = stripCandidateScores([candidates[0]!])[0]!;
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
      candidates: stripCandidateScores(candidates),
      pendingMessage: dm.messageText,
    };
  }

  return { ok: false, reply: "Эта команда выполняется другим способом (поиск или лента)." };
}

export async function confirmScheduleDmCall(
  userId: string,
  input: { targetUserId: string; fireAtIso: string; reminderTitle: string },
): Promise<PingokExecuteResponse> {
  const peerId = input.targetUserId.trim();
  if (!peerId || peerId === userId) {
    return { ok: false, reply: "Некорректный контакт для планирования звонка." };
  }
  const fireAt = new Date(input.fireAtIso);
  if (!Number.isFinite(fireAt.getTime())) {
    return { ok: false, reply: "Некорректное время звонка." };
  }
  const title = input.reminderTitle.trim() || "Позвонить";
  try {
    const [calleeBlocksCaller, callerBlocksCallee] = await Promise.all([
      storage.getBlockFlags(peerId, userId),
      storage.getBlockFlags(userId, peerId),
    ]);
    if (calleeBlocksCaller?.restrictChat) {
      return { ok: false, reply: "Собеседник ограничил вам переписку и звонки." };
    }
    if (callerBlocksCallee?.restrictChat) {
      return { ok: false, reply: "Вы ограничили этому пользователю переписку." };
    }
    const row = await storage.createUserReminder({ userId, title, fireAt });
    const when = fireAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
    const dm = await storage.getOrCreateDmChat(userId, peerId);
    await storage.createDmScheduledCall({
      chatId: dm.id,
      createdByUserId: userId,
      peerUserId: peerId,
      fireAt,
      title: `Звонок · ${when}`,
      plannerReminderId: row.id,
    });
    await postScheduledCallChatNotice(userId, dm.id, fireAt, row.title);
    bumpDmScheduleChatList(userId, dm.id, peerId);
    return {
      ok: true,
      reply: `Звонок запланирован: «${row.title}» на ${when}.`,
      reminderId: row.id,
      chatId: dm.id,
    };
  } catch (e) {
    console.error("[pingok-micro] confirmScheduleDmCall", e);
    return { ok: false, reply: "Не удалось запланировать звонок." };
  }
}

export async function startCallWithUser(
  callerId: string,
  targetUserId: string,
  media: "audio" | "video",
): Promise<PingokExecuteResponse> {
  if (targetUserId === callerId) return { ok: false, reply: "Нельзя звонить самому себе этим способом." };
  try {
    const [calleeBlocksCaller, callerBlocksCallee] = await Promise.all([
      storage.getBlockFlags(targetUserId, callerId),
      storage.getBlockFlags(callerId, targetUserId),
    ]);
    if (calleeBlocksCaller?.restrictChat) {
      return { ok: false, reply: "Собеседник ограничил вам сообщения и звонки." };
    }
    if (callerBlocksCallee?.restrictChat) {
      return { ok: false, reply: "Вы ограничили этому пользователю сообщения и звонки." };
    }
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
