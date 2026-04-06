import { storage } from "../storage";
import { runVoiceOrVideoNoteTranscription } from "./voice-transcribe";
import { ensureChatAccess } from "./ensure-chat-access";
import { MessagesServiceError } from "./messages-service-error";

/** Расшифровка ГС / видеокружка по запросу из меню (не при отправке). */
export async function requestVoiceOrVideoNoteTranscription(
  userId: string,
  chatId: string,
  messageId: string,
): Promise<{ transcript: string }> {
  await ensureChatAccess(userId, chatId);
  if (!process.env.DATABASE_URL) {
    throw new MessagesServiceError(503, "Расшифровка недоступна в этом режиме");
  }
  if (!process.env.CALL_TRANSCRIPTS_ASR_URL?.trim()) {
    throw new MessagesServiceError(503, "Расшифровка не настроена на сервере (CALL_TRANSCRIPTS_ASR_URL)");
  }
  const msg = await storage.getMessage(chatId, messageId);
  if (!msg) {
    throw new MessagesServiceError(404, "Сообщение не найдено");
  }
  if (msg.type !== "voice" && msg.type !== "video_note") {
    throw new MessagesServiceError(400, "Расшифровка только для голосовых и видеокружков");
  }
  const existing = typeof msg.transcript === "string" ? msg.transcript.trim() : "";
  if (existing) {
    return { transcript: existing };
  }
  try {
    await runVoiceOrVideoNoteTranscription(chatId, messageId);
  } catch (error) {
    console.warn("[messages] voice transcription backend failed", {
      chatId,
      messageId,
      userId,
      err: error instanceof Error ? error.message : String(error),
    });
    throw new MessagesServiceError(
      502,
      "Сервис расшифровки временно недоступен. Попробуйте позже."
    );
  }
  const updated = await storage.getMessage(chatId, messageId);
  const t = typeof updated?.transcript === "string" ? updated.transcript.trim() : "";
  if (!t) {
    throw new MessagesServiceError(
      502,
      "Не удалось распознать речь. Проверьте качество записи или доступность ASR."
    );
  }
  return { transcript: t };
}
