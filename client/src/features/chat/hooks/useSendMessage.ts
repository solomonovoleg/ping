/**
 * Хук: отправка текста, редактирование, повтор, вложения, голос. Макс. 300 строк.
 */
import { useState, useRef, useCallback, useEffect, type MutableRefObject } from "react";
import { flushSync } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeContext } from "@/contexts/RealtimeContext";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { ChatRequestError, uploadVoice, uploadChatMedia, uploadChatMediaWithMeta, sendMessage } from "@/lib/chat";
import {
  enqueueOutboxText,
  enqueueOutboxVideoNote,
  enqueueOutboxVoice,
  flushChatOutbox,
  isLikelyOnline,
  newOutboxLocalId,
} from "@/lib/chat-outbox";
import { clearDraft } from "@/lib/chat-drafts";
import { scheduleRevokeObjectURL } from "@/lib/blob-url";
import { compressImage } from "@/lib/compress-image";
import { API, apiFetch, humanizeUploadOrNetworkError } from "@/lib/api-base";
import {
  boostScreenBrightnessForVideoNote,
  pickPhotoFromGallery,
  restoreScreenBrightnessAfterVideoNote,
  takePhotoFromCamera,
  triggerLightHaptic,
} from "@/lib/capacitor-native";
import { playSendSound } from "@/lib/send-sound";
import type { ApiMessage } from "../types";
import { VIDEO_NOTE_MAX_DURATION_SEC, VIDEO_NOTE_RECORD_SIZE_PX } from "../constants";
import { CHAT_FILE_XLSX_MIME } from "@/features/chat/utils/chat-file-payload";
import { chatQueryKeys } from "@/features/chat/chat-query-keys";
import {
  isVideoNoteRecordingStage,
  toLegacyVideoNoteState,
  withVideoNoteLock,
  type VideoNoteStage,
} from "./video-note-state";
import { requestPauseChatMessageMediaPlayback } from "@/features/chat/chat-message-media-playback-interrupt";

export type UseSendMessageParams = {
  chatId: string;
  folderId?: string | null;
  setMessages: React.Dispatch<React.SetStateAction<ApiMessage[]>>;
  user: { id: string; displayName?: string | null; surname?: string | null } | null;
  /** После очистки поля при отправке (кнопка «Отправить» забирает фокус и размонтируется — без refocus клавиатура на мобильных закрывается). */
  onAfterComposerClear?: () => void;
  /** DM: счётчик «быстрых» исходящих для эффекта пульса (заполняется из ChatDetail после useComposerTransferPulse). */
  composerPulseOnOutgoingSentRef?: MutableRefObject<(() => void) | null>;
};

const VIDEO_NOTE_PRESS_MS = 260;
const VIDEO_NOTE_LOCK_DELTA_PX = 56;
const VIDEO_NOTE_CANCEL_DELTA_PX = 72;
const MAX_CHAT_PDF_BYTES = 15 * 1024 * 1024;
const MAX_CHAT_CSV_BYTES = 10 * 1024 * 1024;
const MAX_CHAT_XLSX_BYTES = 10 * 1024 * 1024;

function videoNoteExtension(mime: string): string {
  if (mime.includes("mp4")) return ".mp4";
  if (mime.includes("quicktime")) return ".mov";
  return ".webm";
}

/** iOS / часть WebView отдают пустой `file.type`; сервер `/api/upload/chat-media` уже доверяет расширению. */
const CHAT_IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif)$/i;
const CHAT_VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|3gp|3gpp)$/i;

function isLikelyChatImageFile(file: File): boolean {
  const t = (file.type || "").trim().toLowerCase();
  if (t.startsWith("image/")) return true;
  return CHAT_IMAGE_EXT_RE.test(file.name || "");
}

function isLikelyChatVideoFile(file: File): boolean {
  const t = (file.type || "").trim().toLowerCase();
  if (t.startsWith("video/")) return true;
  return CHAT_VIDEO_EXT_RE.test(file.name || "");
}

/** iOS / Android WebView часто не дают `e.key === "Enter"` в keydown; keyCode и NumpadEnter оставляем как запасной вариант. */
export function isComposerEnterKey(e: React.KeyboardEvent): boolean {
  if (e.key === "Enter" || e.key === "NumpadEnter") return true;
  const ke = e.nativeEvent as KeyboardEvent & { keyCode?: number };
  return ke.keyCode === 13;
}

function mapMediaAccessError(err: unknown): string {
  if (err instanceof Error) {
    const { name, message } = err;
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "Разрешите доступ к камере и микрофону в настройках браузера или приложения";
    }
    if (message?.toLowerCase().includes("not allowed") || message?.toLowerCase().includes("denied permission")) {
      return "Разрешите доступ к камере и микрофону в настройках браузера или приложения";
    }
    if (name === "NotFoundError") return "Камера или микрофон не найдены";
    if (name === "UnknownError") {
      return "Камера или микрофон временно недоступны. Повторите или обновите страницу.";
    }
    if (name === "NotReadableError") return "Устройство занято. Закройте другие приложения, использующие камеру.";
    if (name === "OverconstrainedError") return "Параметры камеры не поддерживаются на этом устройстве.";
  }
  return "Не удалось запустить запись видеокружка";
}

function isAbortError(err: unknown): boolean {
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    return err.name === "AbortError";
  }
  return err instanceof Error && err.name === "AbortError";
}

async function delayMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

type VideoNoteMetricName =
  | "record_start"
  | "record_stop"
  | "send_queued"
  | "send_success"
  | "send_failed";

function emitVideoNoteMetric(name: VideoNoteMetricName, detail?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("ping:video-note-metric", {
      detail: { name, ts: Date.now(), ...detail },
    }),
  );
  if (import.meta.env.DEV) {
    // Быстрый локальный аудит в консоли без внешней аналитики.
    console.debug("[video-note-metric]", name, detail ?? {});
  }
}

export function useSendMessage({
  chatId,
  folderId,
  setMessages,
  user,
  onAfterComposerClear,
  composerPulseOnOutgoingSentRef,
}: UseSendMessageParams) {
  const queryClient = useQueryClient();
  const onAfterComposerClearRef = useRef(onAfterComposerClear);
  onAfterComposerClearRef.current = onAfterComposerClear;
  const { toast } = useToast();
  const { sendVoiceRecording } = useRealtimeContext();
  const { state: voiceState, error: voiceRecorderError, durationSec, start: startVoice, stop: stopVoice, isSupported: voiceSupported } = useVoiceRecorder();

  const [message, setMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<ApiMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [sending, setSending] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [mediaUploadPercent, setMediaUploadPercent] = useState<number | null>(null);
  const [voiceUploadPercent, setVoiceUploadPercent] = useState<number | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [videoNoteStage, setVideoNoteStage] = useState<VideoNoteStage>("idle");
  const [videoNoteError, setVideoNoteError] = useState<string | null>(null);
  const [videoNoteDurationSec, setVideoNoteDurationSec] = useState(0);
  const [videoNotePreviewUrl, setVideoNotePreviewUrl] = useState<string | null>(null);
  const [videoNoteLocked, setVideoNoteLocked] = useState(false);
  const [videoNoteLockProgress, setVideoNoteLockProgress] = useState(0);
  const [videoNoteCancelProgress, setVideoNoteCancelProgress] = useState(0);
  const [videoNoteFacingUser, setVideoNoteFacingUser] = useState(true);
  const [videoNoteSoftLight, setVideoNoteSoftLight] = useState(false);
  /** Поток для размытого фона модалки записи (как в Telegram); отдельно от ref живого превью. */
  const [videoNoteBackgroundStream, setVideoNoteBackgroundStream] = useState<MediaStream | null>(null);
  const videoNoteFacingUserRef = useRef(true);
  const videoNoteFlipInFlightRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const videoNoteInputRef = useRef<HTMLInputElement>(null);
  const videoNoteLiveRef = useRef<HTMLVideoElement | null>(null);
  const sendingLockRef = useRef(false);
  const sendingMediaLockRef = useRef(false);
  const sendingVoiceLockRef = useRef(false);
  const voicePressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voicePressStartedRef = useRef(false);
  const voiceBlobRef = useRef<Blob | null>(null);
  const voiceFinishingRef = useRef(false);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [voicePreviewDurationSec, setVoicePreviewDurationSec] = useState(0);
  const videoNoteRecorderRef = useRef<MediaRecorder | null>(null);
  const videoNoteStreamRef = useRef<MediaStream | null>(null);
  const videoNoteChunksRef = useRef<Blob[]>([]);
  const videoNoteBlobRef = useRef<Blob | null>(null);
  const videoNoteMimeRef = useRef<string>("");
  const videoNoteRecorderStreamRef = useRef<MediaStream | null>(null);
  const videoNoteMirrorVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoNoteMirrorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoNoteMirrorRafRef = useRef<number | null>(null);
  const videoNoteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoNoteStartedAtRef = useRef<number | null>(null);
  const videoNotePressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoNotePressConsumedRef = useRef(false);
  const videoNotePointerStartYRef = useRef<number | null>(null);
  const videoNotePointerStartXRef = useRef<number | null>(null);
  const videoNotePointerActiveRef = useRef(false);
  const videoNoteCancelTriggeredRef = useRef(false);
  const stopVideoNoteRecordingRef = useRef<(() => Promise<void>) | null>(null);
  const videoNoteSendAbortRef = useRef<AbortController | null>(null);
  const videoNoteState = toLegacyVideoNoteState(videoNoteStage);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setMessage("");
  }, []);

  const videoNoteSupported =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined";

  const clearVideoNoteTimer = useCallback(() => {
    if (videoNoteTimerRef.current) {
      clearInterval(videoNoteTimerRef.current);
      videoNoteTimerRef.current = null;
    }
    videoNoteStartedAtRef.current = null;
  }, []);

  const revokeVideoNotePreview = useCallback(() => {
    setVideoNotePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const revokeVoicePreview = useCallback(() => {
    setVoicePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    voiceBlobRef.current = null;
    setVoicePreviewDurationSec(0);
  }, []);

  const detachVideoNoteLive = useCallback(() => {
    const el = videoNoteLiveRef.current;
    if (!el) return;
    try {
      el.pause();
    } catch {}
    el.srcObject = null;
  }, []);

  const stopVideoNoteStream = useCallback(() => {
    const stream = videoNoteStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      videoNoteStreamRef.current = null;
    }
    detachVideoNoteLive();
  }, [detachVideoNoteLive]);

  const clearVideoNoteMirrorPipeline = useCallback(() => {
    if (videoNoteMirrorRafRef.current != null) {
      cancelAnimationFrame(videoNoteMirrorRafRef.current);
      videoNoteMirrorRafRef.current = null;
    }
    const recorderStream = videoNoteRecorderStreamRef.current;
    if (recorderStream) {
      recorderStream.getTracks().forEach((t) => t.stop());
      videoNoteRecorderStreamRef.current = null;
    }
    const mirrorVideo = videoNoteMirrorVideoRef.current;
    if (mirrorVideo) {
      try {
        mirrorVideo.pause();
      } catch {}
      mirrorVideo.srcObject = null;
      videoNoteMirrorVideoRef.current = null;
    }
    videoNoteMirrorCanvasRef.current = null;
  }, []);

  const clearVideoNotePressTimer = useCallback(() => {
    if (videoNotePressTimerRef.current) {
      clearTimeout(videoNotePressTimerRef.current);
      videoNotePressTimerRef.current = null;
    }
  }, []);

  const setVideoNoteLiveElement = useCallback((el: HTMLVideoElement | null) => {
    videoNoteLiveRef.current = el;
    if (!el) return;
    const stream = videoNoteStreamRef.current;
    if (stream) {
      el.srcObject = stream;
      el.muted = true;
      el.playsInline = true;
      void el.play().catch(() => {});
    }
  }, []);

  const handleSend = useCallback(async () => {
    const text = message.trim();
    if (!text || !user || sending || sendingLockRef.current) return;
    sendingLockRef.current = true;
    triggerLightHaptic();
    if (editingId) {
      const idToEdit = editingId;
      let prevContent = "";
      flushSync(() => {
        setEditingId(null);
        setMessage("");
      });
      onAfterComposerClearRef.current?.();
      setSending(true);
      setMessages((prev) => {
        const msg = prev.find((m) => m.id === idToEdit);
        prevContent = msg?.content ?? "";
        return prev.map((m) => (m.id === idToEdit ? { ...m, content: text } : m));
      });
      try {
        const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(idToEdit)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });
        if (res.ok) {
          const data = await res.json();
          setMessages((prev) => prev.map((m) => (m.id === idToEdit ? { ...m, content: data.content ?? text } : m)));
          toast({ title: "Изменения сохранены" });
        } else {
          setMessages((prev) => prev.map((m) => (m.id === idToEdit ? { ...m, content: prevContent } : m)));
          const data = await res.json().catch(() => ({}));
          toast({ title: data.message ?? "Не удалось сохранить", variant: "destructive" });
          setMessage(text);
          setEditingId(idToEdit);
        }
      } catch {
        setMessages((prev) => prev.map((m) => (m.id === idToEdit ? { ...m, content: prevContent } : m)));
        toast({ title: "Ошибка", variant: "destructive" });
        setMessage(text);
        setEditingId(idToEdit);
      } finally {
        setSending(false);
        sendingLockRef.current = false;
      }
      return;
    }
    const replyToMsg = replyingTo;
    setReplyingTo(null);
    const isScheduled = scheduledAt && scheduledAt > new Date();
    if (isScheduled) setScheduledAt(null);
    flushSync(() => {
      setMessage("");
    });
    onAfterComposerClearRef.current?.();
    setSending(true);
    clearDraft(chatId);
    const localId = newOutboxLocalId();
    if (!isScheduled) {
      const optimistic: ApiMessage = {
        id: localId, chatId, senderId: user.id, type: "text", content: text,
        replyToId: replyToMsg?.id ?? undefined,
        replyTo: replyToMsg ? { id: replyToMsg.id, senderId: replyToMsg.senderId, type: replyToMsg.type, content: replyToMsg.type === "text" ? replyToMsg.content.slice(0, 200) : replyToMsg.type } : undefined,
        createdAt: new Date().toISOString(), sendStatus: "sending",
      };
      flushSync(() => setMessages((prev) => [...prev, optimistic]));
    }
    playSendSound();

    if (!isScheduled && !isLikelyOnline()) {
      const ok = await enqueueOutboxText({
        localId,
        chatId,
        userId: user.id,
        folderId,
        replyToId: replyToMsg?.id ?? null,
        text,
      });
      if (!ok) {
        setMessages((prev) => prev.filter((m) => m.id !== localId));
        setMessage(text);
        setReplyingTo(replyToMsg);
        toast({ title: "Очередь переполнена", description: "Удалите старые или дождитесь сети.", variant: "destructive" });
      } else {
        toast({ title: "Нет сети", description: "Сообщение в очереди — отправим при появлении связи." });
        void flushChatOutbox();
        composerPulseOnOutgoingSentRef?.current?.();
      }
      setSending(false);
      sendingLockRef.current = false;
      return;
    }

    try {
      const body: { content: string; folderId?: string; replyToId?: string; scheduledAt?: string } = { content: text };
      if (folderId) body.folderId = folderId;
      if (replyToMsg?.id) body.replyToId = replyToMsg.id;
      if (isScheduled) body.scheduledAt = scheduledAt!.toISOString();
      const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (isScheduled) {
          const at = data.scheduledAt ? new Date(data.scheduledAt) : scheduledAt;
          const label = at.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
          toast({ title: `Отправится в ${label}` });
        } else if (data.id) {
          setMessages((prev) => {
            const alreadyHasReal = prev.some((m) => m.id === data.id);
            if (alreadyHasReal) return prev.filter((m) => m.id !== localId);
            return prev.map((m) => m.id === localId ? { ...m, id: data.id, replyToId: data.replyToId ?? m.replyToId, createdAt: data.createdAt ?? m.createdAt, sendStatus: "sent" as const } : m);
          });
          composerPulseOnOutgoingSentRef?.current?.();
          queryClient.invalidateQueries({ queryKey: chatQueryKeys.messagesAll(chatId) });
        }
      } else {
        if (!isScheduled && !isLikelyOnline()) {
          const ok = await enqueueOutboxText({
            localId,
            chatId,
            userId: user.id,
            folderId,
            replyToId: replyToMsg?.id ?? null,
            text,
          });
          if (ok) {
            toast({ title: "Нет сети", description: "Сообщение в очереди — отправим при появлении связи." });
            void flushChatOutbox();
          } else {
            setMessages((prev) => prev.map((m) => (m.id === localId ? { ...m, sendStatus: "failed" as const } : m)));
            setMessage(text);
            toast({ title: "Не удалось сохранить в очередь", variant: "destructive" });
          }
        } else {
          if (!isScheduled) setMessages((prev) => prev.map((m) => (m.id === localId ? { ...m, sendStatus: "failed" as const } : m)));
          setMessage(text);
          const msg = (data && typeof data.message === "string" ? data.message : null) || "Не удалось отправить";
          toast({ title: msg, variant: "destructive" });
        }
      }
    } catch {
      if (!isScheduled) {
        const ok = await enqueueOutboxText({
          localId,
          chatId,
          userId: user.id,
          folderId,
          replyToId: replyToMsg?.id ?? null,
          text,
        });
        if (ok) {
          toast({ title: "Нет сети", description: "Сообщение в очереди — отправим при появлении связи." });
          void flushChatOutbox();
        } else {
          setMessages((prev) => prev.map((m) => (m.id === localId ? { ...m, sendStatus: "failed" as const } : m)));
          setMessage(text);
          toast({ title: "Не удалось сохранить в очередь", variant: "destructive" });
        }
      } else {
        setMessage(text);
        toast({ title: "Нет сети", variant: "destructive" });
      }
    } finally {
      setSending(false);
      sendingLockRef.current = false;
    }
  }, [
    chatId,
    folderId,
    user,
    message,
    sending,
    replyingTo,
    editingId,
    scheduledAt,
    setMessages,
    toast,
    composerPulseOnOutgoingSentRef,
  ]);

  const handleRetryFailedMessage = useCallback(
    async (msg: ApiMessage) => {
      if (msg.sendStatus !== "failed" || !user || msg.chatId !== chatId) return;
      const text = msg.content;
      flushSync(() => setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, sendStatus: "sending" as const } : m))));
      try {
        const body: { content: string; folderId?: string; replyToId?: string } = { content: text };
        if (folderId) body.folderId = folderId;
        if (msg.replyToId) body.replyToId = msg.replyToId;
        const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/messages`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.id) {
          setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, id: data.id, createdAt: data.createdAt ?? m.createdAt, sendStatus: "sent" as const } : m));
          playSendSound();
          composerPulseOnOutgoingSentRef?.current?.();
        } else {
          if (!isLikelyOnline()) {
            const newId = newOutboxLocalId();
            const ok = await enqueueOutboxText({
              localId: newId,
              chatId,
              userId: user.id,
              folderId,
              replyToId: msg.replyToId ?? null,
              text,
            });
            if (ok) {
              setMessages((prev) =>
                prev.map((m) => (m.id === msg.id ? { ...m, id: newId, sendStatus: "sending" as const } : m))
              );
              toast({ title: "В очереди", description: "Отправим при появлении связи." });
              void flushChatOutbox();
            } else {
              setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, sendStatus: "failed" as const } : m)));
              toast({ title: "Не удалось сохранить в очередь", variant: "destructive" });
            }
          } else {
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, sendStatus: "failed" as const } : m)));
            toast({ title: "Не отправлено", variant: "destructive" });
          }
        }
      } catch {
        const newId = newOutboxLocalId();
        const ok = await enqueueOutboxText({
          localId: newId,
          chatId,
          userId: user.id,
          folderId,
          replyToId: msg.replyToId ?? null,
          text,
        });
        if (ok) {
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.id ? { ...m, id: newId, sendStatus: "sending" as const } : m))
          );
          toast({ title: "В очереди", description: "Отправим при появлении связи." });
          void flushChatOutbox();
        } else {
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, sendStatus: "failed" as const } : m)));
          toast({ title: "Не удалось сохранить в очередь", variant: "destructive" });
        }
      }
    },
    [chatId, folderId, user, setMessages, toast, composerPulseOnOutgoingSentRef]
  );

  const insertMentionAtPosition = useCallback((start: number, end: number, text: string): number => {
    const newCursor = start + text.length;
    setMessage((prev) => prev.slice(0, start) + text + prev.slice(end));
    return newCursor;
  }, []);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingId && e.key === "Escape") { e.preventDefault(); handleCancelEdit(); return; }
      if (isComposerEnterKey(e) && !e.shiftKey) { e.preventDefault(); void handleSend(); }
    },
    [editingId, handleCancelEdit, handleSend]
  );

  const dataUrlToFile = useCallback(async (dataUrl: string, name = "photo.jpg"): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || "image/jpeg" });
  }, []);

  const attachImageOrVideoFile = useCallback(
    async (file: File) => {
      if (!user || !chatId) return;
      revokeVoicePreview();
      const isVideo = isLikelyChatVideoFile(file);
      const isImage = isLikelyChatImageFile(file);
      if (!isImage && !isVideo) {
        toast({ title: "Разрешены только фото и видео", variant: "destructive" });
        return;
      }
      if (sendingMediaLockRef.current) return;
      sendingMediaLockRef.current = true;
      setSendingMedia(true);
      setMediaUploadPercent(0);
      try {
        const toUpload = isImage ? await compressImage(file) : file;
        const url = await uploadChatMedia(toUpload, { onProgress: (p) => setMediaUploadPercent(p) });
        const type = isVideo ? "video" : "image";
        const sent = await sendMessage(chatId, { type, content: url, folderId: folderId ?? undefined });
        setMessages((prev) => {
          if (prev.some((m) => m.id === sent.id)) return prev;
          return [
            ...prev,
            {
              id: sent.id,
              chatId,
              senderId: user.id,
              type,
              content: sent.content,
              createdAt: sent.createdAt,
              sendStatus: "sent" as const,
              ...(type === "video" && sent.videoPosterUrl != null ? { videoPosterUrl: sent.videoPosterUrl } : {}),
            },
          ];
        });
        playSendSound();
        composerPulseOnOutgoingSentRef?.current?.();
      } catch (err) {
        toast({
          title: humanizeUploadOrNetworkError(err, "Не отправлено"),
          variant: "destructive",
        });
      } finally {
        sendingMediaLockRef.current = false;
        setSendingMedia(false);
        setMediaUploadPercent(null);
      }
    },
    [chatId, folderId, user?.id, toast, setMessages, revokeVoicePreview, composerPulseOnOutgoingSentRef]
  );

  const attachChatDocumentFile = useCallback(
    async (file: File): Promise<boolean> => {
      if (!user || !chatId) return false;
      revokeVoicePreview();
      const lower = file.name.toLowerCase();
      const mime = (file.type || "").toLowerCase();
      const isPdf =
        mime === "application/pdf" || mime === "application/x-pdf" || lower.endsWith(".pdf");
      const isCsv =
        mime === "text/csv" || mime === "application/csv" || lower.endsWith(".csv");
      const isXlsx = mime === CHAT_FILE_XLSX_MIME || lower.endsWith(".xlsx");
      if (!isPdf && !isCsv && !isXlsx) {
        toast({ title: "Нужен файл PDF, CSV или XLSX", variant: "destructive" });
        return false;
      }
      if (isPdf && file.size > MAX_CHAT_PDF_BYTES) {
        toast({ title: "PDF не больше 15 МБ", variant: "destructive" });
        return false;
      }
      if (isCsv && file.size > MAX_CHAT_CSV_BYTES) {
        toast({ title: "CSV не больше 10 МБ", variant: "destructive" });
        return false;
      }
      if (isXlsx && file.size > MAX_CHAT_XLSX_BYTES) {
        toast({ title: "Excel не больше 10 МБ", variant: "destructive" });
        return false;
      }
      if (sendingMediaLockRef.current) return false;
      sendingMediaLockRef.current = true;
      setSendingMedia(true);
      setMediaUploadPercent(0);
      try {
        const { url } = await uploadChatMediaWithMeta(file, { onProgress: (p) => setMediaUploadPercent(p) });
        const outMime = isPdf ? "application/pdf" : isXlsx ? CHAT_FILE_XLSX_MIME : "text/csv";
        const defaultName = isPdf ? "document.pdf" : isXlsx ? "table.xlsx" : "table.csv";
        const content = JSON.stringify({
          url,
          name: (file.name || "").trim() || defaultName,
          mime: outMime,
          size: file.size,
        });
        const sent = await sendMessage(chatId, { type: "file", content, folderId: folderId ?? undefined });
        setMessages((prev) => {
          if (prev.some((m) => m.id === sent.id)) return prev;
          return [
            ...prev,
            {
              id: sent.id,
              chatId,
              senderId: user.id,
              type: "file" as const,
              content,
              createdAt: sent.createdAt,
              sendStatus: "sent" as const,
            },
          ];
        });
        playSendSound();
        composerPulseOnOutgoingSentRef?.current?.();
        return true;
      } catch (err) {
        toast({ title: humanizeUploadOrNetworkError(err, "Не отправлено"), variant: "destructive" });
        return false;
      } finally {
        sendingMediaLockRef.current = false;
        setSendingMedia(false);
        setMediaUploadPercent(null);
      }
    },
    [chatId, folderId, user?.id, toast, setMessages, revokeVoicePreview, composerPulseOnOutgoingSentRef]
  );

  const attachPdfFile = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      const mime = (file.type || "").toLowerCase();
      const okPdf =
        mime === "application/pdf" || mime === "application/x-pdf" || lower.endsWith(".pdf");
      if (!okPdf) {
        toast({ title: "Нужен файл в формате PDF", variant: "destructive" });
        return;
      }
      void attachChatDocumentFile(file);
    },
    [attachChatDocumentFile, toast]
  );

  const handleAttachFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      await attachImageOrVideoFile(file);
    },
    [attachImageOrVideoFile]
  );

  const handleAttachPdfFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      await attachPdfFile(file);
    },
    [attachPdfFile]
  );

  /** Десктоп: drag-and-drop в область чата — те же типы, что и через скрепку (фото, видео, PDF, CSV, XLSX). */
  const handleDroppedFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length || !user || !chatId) return;
      const files = Array.from(fileList);
      for (const file of files) {
        const lower = file.name.toLowerCase();
        const mime = (file.type || "").toLowerCase();
        const okPdfMime = mime === "application/pdf" || mime === "application/x-pdf";
        const okPdfName = lower.endsWith(".pdf");
        if (okPdfMime || okPdfName) {
          await attachPdfFile(file);
          continue;
        }
        const okCsv = mime === "text/csv" || mime === "application/csv" || lower.endsWith(".csv");
        if (okCsv) {
          await attachChatDocumentFile(file);
          continue;
        }
        const okXlsx = mime === CHAT_FILE_XLSX_MIME || lower.endsWith(".xlsx");
        if (okXlsx) {
          await attachChatDocumentFile(file);
          continue;
        }
        if (isLikelyChatImageFile(file) || isLikelyChatVideoFile(file)) {
          await attachImageOrVideoFile(file);
          continue;
        }
        toast({
          title: "Формат не поддерживается",
          description: file.name
            ? `«${file.name}» — только фото, видео, PDF, CSV или XLSX.`
            : "Только фото, видео, PDF, CSV или XLSX.",
          variant: "destructive",
        });
      }
    },
    [user, chatId, attachPdfFile, attachChatDocumentFile, attachImageOrVideoFile, toast]
  );

  const handleAttachFromNative = useCallback(
    async (source: "camera" | "gallery") => {
      if (!user || !chatId) return;
      if (sendingMediaLockRef.current) return;
      revokeVoicePreview();
      let dataUrl: string | null = null;
      try {
        if (source === "camera") dataUrl = await takePhotoFromCamera();
        else dataUrl = await pickPhotoFromGallery();
      } catch {
        toast({ title: "Не удалось открыть камеру или галерею", variant: "destructive" });
        return;
      }
      if (!dataUrl) return;
      sendingMediaLockRef.current = true;
      setSendingMedia(true);
      setMediaUploadPercent(0);
      try {
        const file = await dataUrlToFile(dataUrl);
        const toUpload = await compressImage(file);
        const url = await uploadChatMedia(toUpload, { onProgress: (p) => setMediaUploadPercent(p) });
        const sent = await sendMessage(chatId, { type: "image", content: url, folderId: folderId ?? undefined });
        setMessages((prev) => {
          if (prev.some((m) => m.id === sent.id)) return prev;
          return [
            ...prev,
            {
              id: sent.id,
              chatId,
              senderId: user.id,
              type: "image",
              content: sent.content,
              createdAt: sent.createdAt,
              sendStatus: "sent" as const,
            },
          ];
        });
        playSendSound();
        composerPulseOnOutgoingSentRef?.current?.();
      } catch (err) {
        toast({ title: humanizeUploadOrNetworkError(err, "Не отправлено"), variant: "destructive" });
      } finally {
        sendingMediaLockRef.current = false;
        setSendingMedia(false);
        setMediaUploadPercent(null);
      }
    },
    [chatId, folderId, user?.id, toast, dataUrlToFile, setMessages, revokeVoicePreview, composerPulseOnOutgoingSentRef]
  );

  const handleVideoNoteFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !user || !chatId) return;
      revokeVoicePreview();
      if (!isLikelyChatVideoFile(file)) {
        toast({ title: "Нужен видеофайл для видеокружка", variant: "destructive" });
        return;
      }
      const localId = newOutboxLocalId();
      const displayUrl = URL.createObjectURL(file);
      setMessages((prev) => [
        ...prev,
        {
          id: localId,
          chatId,
          senderId: user.id,
          type: "video_note",
          content: displayUrl,
          videoPosterUrl: null,
          createdAt: new Date().toISOString(),
          sendStatus: "sending" as const,
          localUploadProgress: 0,
        },
      ]);
      playSendSound();
      composerPulseOnOutgoingSentRef?.current?.();
      void (async () => {
        try {
          const { url, posterUrl } = await uploadChatMediaWithMeta(file, {
            onProgress: (p) =>
              setMessages((prev) =>
                prev.map((m) => (m.id === localId ? { ...m, localUploadProgress: p } : m)),
              ),
          });
          const sent = await sendMessage(chatId, { type: "video_note", content: url, folderId: folderId ?? undefined });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === localId
                ? {
                    id: sent.id,
                    chatId,
                    senderId: user.id,
                    type: "video_note" as const,
                    content: sent.content,
                    videoPosterUrl: sent.videoPosterUrl ?? posterUrl ?? null,
                    createdAt: sent.createdAt,
                    sendStatus: "sent" as const,
                  }
                : m,
            ),
          );
          URL.revokeObjectURL(displayUrl);
        } catch (err) {
          URL.revokeObjectURL(displayUrl);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === localId
                ? { ...m, sendStatus: "failed" as const, localUploadProgress: undefined }
                : m,
            ),
          );
          toast({ title: humanizeUploadOrNetworkError(err, "Видеокружок не отправлен"), variant: "destructive" });
        }
      })();
    },
    [chatId, folderId, user?.id, setMessages, toast, revokeVoicePreview, composerPulseOnOutgoingSentRef]
  );

  const startVideoNoteRecording = useCallback(async () => {
    if (!videoNoteSupported || isVideoNoteRecordingStage(videoNoteStage) || sendingMedia) return;
    requestPauseChatMessageMediaPlayback();
    revokeVoicePreview();
    setVideoNoteError(null);
    revokeVideoNotePreview();
    videoNoteBlobRef.current = null;
    clearVideoNoteMirrorPipeline();
    try {
      videoNoteFacingUserRef.current = true;
      setVideoNoteFacingUser(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: true,
      });
      videoNoteStreamRef.current = stream;
      setVideoNoteBackgroundStream(stream);
      if (videoNoteLiveRef.current) {
        videoNoteLiveRef.current.srcObject = stream;
        videoNoteLiveRef.current.muted = true;
        videoNoteLiveRef.current.playsInline = true;
        void videoNoteLiveRef.current.play().catch(() => {});
      }

      const mimeType = MediaRecorder.isTypeSupported("video/mp4")
        ? "video/mp4"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
            ? "video/webm;codecs=vp8,opus"
            : "video/webm";
      videoNoteMimeRef.current = mimeType;

      // Записываем зеркальный видеопоток: отрисовываем фронт-камеру на canvas с горизонтальным flip.
      const mirrorVideo = document.createElement("video");
      mirrorVideo.srcObject = stream;
      mirrorVideo.muted = true;
      mirrorVideo.playsInline = true;
      await mirrorVideo.play().catch(() => {});
      const canvas = document.createElement("canvas");
      const S = VIDEO_NOTE_RECORD_SIZE_PX;
      canvas.width = S;
      canvas.height = S;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Не удалось подготовить зеркальную запись видео");
      }
      /** Квадратный кадр с object-cover (как круглый превью в чате). */
      const drawMirrorFrame = () => {
        const vw = mirrorVideo.videoWidth || 0;
        const vh = mirrorVideo.videoHeight || 0;
        if (vw > 0 && vh > 0) {
          ctx.save();
          ctx.clearRect(0, 0, S, S);
          if (videoNoteFacingUserRef.current) {
            ctx.translate(S, 0);
            ctx.scale(-1, 1);
          }
          const r = Math.max(S / vw, S / vh);
          const nw = vw * r;
          const nh = vh * r;
          const ox = (S - nw) / 2;
          const oy = (S - nh) / 2;
          try {
            ctx.drawImage(mirrorVideo, 0, 0, vw, vh, ox, oy, nw, nh);
          } catch {
            /* кадр ещё не готов */
          }
          ctx.restore();
        }
        videoNoteMirrorRafRef.current = requestAnimationFrame(drawMirrorFrame);
      };
      drawMirrorFrame();
      const mirroredVideoTrack = canvas.captureStream(30).getVideoTracks()[0];
      if (!mirroredVideoTrack) {
        throw new Error("Не удалось получить видеопоток для записи");
      }
      const recorderStream = new MediaStream([mirroredVideoTrack, ...stream.getAudioTracks()]);
      videoNoteRecorderStreamRef.current = recorderStream;
      videoNoteMirrorVideoRef.current = mirrorVideo;
      videoNoteMirrorCanvasRef.current = canvas;

      const recorder = new MediaRecorder(recorderStream, { mimeType });
      videoNoteRecorderRef.current = recorder;
      videoNoteChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) videoNoteChunksRef.current.push(event.data);
      };
      recorder.start(250);
      emitVideoNoteMetric("record_start", { chatId, facingUser: true });
      clearVideoNoteTimer();
      setVideoNoteStage("recording");
      setVideoNoteLocked(false);
      setVideoNoteLockProgress(0);
      setVideoNoteCancelProgress(0);
      setVideoNoteDurationSec(0);
      videoNoteStartedAtRef.current = Date.now();
      videoNoteTimerRef.current = setInterval(() => {
        const started = videoNoteStartedAtRef.current;
        if (!started) return;
        const sec = Math.min(VIDEO_NOTE_MAX_DURATION_SEC, Math.floor((Date.now() - started) / 1000));
        setVideoNoteDurationSec(sec);
        if (sec >= VIDEO_NOTE_MAX_DURATION_SEC) {
          void stopVideoNoteRecordingRef.current?.();
        }
      }, 250);
    } catch (err) {
      stopVideoNoteStream();
      setVideoNoteBackgroundStream(null);
      clearVideoNoteMirrorPipeline();
      clearVideoNoteTimer();
      setVideoNoteStage("error");
      setTimeout(() => setVideoNoteStage("idle"), 0);
      setVideoNoteError(mapMediaAccessError(err));
    }
  }, [
    videoNoteSupported,
    videoNoteStage,
    sendingMedia,
    revokeVoicePreview,
    revokeVideoNotePreview,
    clearVideoNoteMirrorPipeline,
    clearVideoNoteTimer,
    stopVideoNoteStream,
    chatId,
  ]);

  const stopVideoNoteRecording = useCallback(async () => {
    const recorder = videoNoteRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    clearVideoNoteTimer();
    stopVideoNoteStream();
    setVideoNoteBackgroundStream(null);
    setVideoNoteSoftLight(false);
    clearVideoNoteMirrorPipeline();
    const blobType =
      recorder.mimeType ||
      (videoNoteMimeRef.current && videoNoteMimeRef.current.startsWith("video/")
        ? videoNoteMimeRef.current.split(";")[0]
        : "video/webm");
    const blob =
      videoNoteChunksRef.current.length > 0
        ? new Blob(videoNoteChunksRef.current, { type: blobType })
        : null;
    emitVideoNoteMetric("record_stop", { chatId, blobSize: blob?.size ?? 0 });
    videoNoteChunksRef.current = [];
    if (!blob || blob.size === 0) {
      setVideoNoteStage("idle");
      setVideoNoteDurationSec(0);
      setVideoNoteLocked(false);
      setVideoNoteLockProgress(0);
      setVideoNoteCancelProgress(0);
      return;
    }
    videoNoteBlobRef.current = blob;
    revokeVideoNotePreview();
    const objectUrl = URL.createObjectURL(blob);
    setVideoNotePreviewUrl(objectUrl);
    setVideoNoteStage("preview");
    setVideoNoteLocked(false);
    setVideoNoteLockProgress(0);
    setVideoNoteCancelProgress(0);
  }, [clearVideoNoteMirrorPipeline, clearVideoNoteTimer, stopVideoNoteStream, revokeVideoNotePreview, chatId]);

  stopVideoNoteRecordingRef.current = stopVideoNoteRecording;

  const cancelVideoNote = useCallback(() => {
    if (videoNoteSendAbortRef.current) {
      videoNoteSendAbortRef.current.abort();
      videoNoteSendAbortRef.current = null;
    }
    clearVideoNotePressTimer();
    const recorder = videoNoteRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      try {
        recorder.onstop = () => {};
        recorder.stop();
      } catch {}
    }
    clearVideoNoteTimer();
    stopVideoNoteStream();
    clearVideoNoteMirrorPipeline();
    videoNoteRecorderRef.current = null;
    videoNoteChunksRef.current = [];
    videoNoteBlobRef.current = null;
    setVideoNoteDurationSec(0);
    setVideoNoteStage("idle");
    setVideoNoteLocked(false);
    setVideoNoteLockProgress(0);
    setVideoNoteCancelProgress(0);
    videoNotePointerStartYRef.current = null;
    videoNotePointerStartXRef.current = null;
    videoNotePointerActiveRef.current = false;
    videoNoteCancelTriggeredRef.current = false;
    videoNoteFacingUserRef.current = true;
    setVideoNoteFacingUser(true);
    setVideoNoteSoftLight(false);
    setVideoNoteBackgroundStream(null);
    void restoreScreenBrightnessAfterVideoNote();
    revokeVideoNotePreview();
  }, [clearVideoNotePressTimer, clearVideoNoteMirrorPipeline, clearVideoNoteTimer, stopVideoNoteStream, revokeVideoNotePreview]);

  const flipVideoNoteCamera = useCallback(async () => {
    if (!isVideoNoteRecordingStage(videoNoteStage) || videoNoteFlipInFlightRef.current) return;
    const mirrorVideo = videoNoteMirrorVideoRef.current;
    if (!mirrorVideo) return;
    videoNoteFlipInFlightRef.current = true;
    try {
      const oldStream = videoNoteStreamRef.current;
      if (!oldStream) return;
      const audioTracks = oldStream.getAudioTracks();
      oldStream.getVideoTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      const nextFacingUser = !videoNoteFacingUserRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: nextFacingUser ? "user" : { ideal: "environment" },
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      const newStream = new MediaStream([...stream.getVideoTracks(), ...audioTracks]);
      videoNoteStreamRef.current = newStream;
      setVideoNoteBackgroundStream(newStream);
      if (!nextFacingUser) setVideoNoteSoftLight(false);
      mirrorVideo.srcObject = newStream;
      await mirrorVideo.play().catch(() => {});
      if (videoNoteLiveRef.current) {
        const live = videoNoteLiveRef.current;
        live.srcObject = newStream;
        live.muted = true;
        live.playsInline = true;
        void live.play().catch(() => {});
      }
      videoNoteFacingUserRef.current = nextFacingUser;
      setVideoNoteFacingUser(nextFacingUser);
      triggerLightHaptic();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[video-note] flip camera", err);
      }
      toast({ title: "Не удалось переключить камеру", variant: "destructive" });
      cancelVideoNote();
    } finally {
      videoNoteFlipInFlightRef.current = false;
    }
  }, [videoNoteStage, toast, cancelVideoNote]);

  const sendRecordedVideoNote = useCallback(async () => {
    if (!user || !chatId) return;
    const blob = videoNoteBlobRef.current;
    if (!blob || blob.size === 0) return;
    const localId = newOutboxLocalId();
    const displayUrl = URL.createObjectURL(blob);
    setVideoNoteError(null);
    setMessages((prev) => [
      ...prev,
      {
        id: localId,
        chatId,
        senderId: user.id,
        type: "video_note",
        content: displayUrl,
        videoPosterUrl: null,
        createdAt: new Date().toISOString(),
        sendStatus: "sending" as const,
        localUploadProgress: 0,
      },
    ]);
    playSendSound();
    composerPulseOnOutgoingSentRef?.current?.();
    cancelVideoNote();
    setVideoNoteStage("sending");

    const pushQueuedVideoNote = async (): Promise<boolean> => {
      const ok = await enqueueOutboxVideoNote({
        localId,
        chatId,
        userId: user.id,
        folderId,
        blob,
      });
      if (ok) {
        emitVideoNoteMetric("send_queued", { chatId, localId, blobSize: blob.size });
        toast({ title: "Нет сети", description: "Видеокружок в очереди — отправим при появлении связи." });
        void flushChatOutbox();
      }
      return ok;
    };

    if (!isLikelyOnline()) {
      const queued = await pushQueuedVideoNote();
      if (!queued) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === localId ? { ...m, sendStatus: "failed" as const, localUploadProgress: undefined } : m,
          ),
        );
        toast({ title: "Не удалось сохранить в очередь", variant: "destructive" });
      }
      setVideoNoteStage("idle");
      return;
    }

    const type = blob.type || "video/webm";
    const file = new File([blob], `video-note${videoNoteExtension(type)}`, { type });
    const aborter = new AbortController();
    videoNoteSendAbortRef.current = aborter;
    try {
      let uploaded: { url: string; posterUrl?: string | null } | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          uploaded = await uploadChatMediaWithMeta(file, {
            signal: aborter.signal,
            onProgress: (p) =>
              setMessages((prev) => prev.map((m) => (m.id === localId ? { ...m, localUploadProgress: p } : m))),
          });
          break;
        } catch (err) {
          if (isAbortError(err)) throw err;
          if (attempt === 3) throw err;
          if (!isLikelyOnline()) throw err;
          await delayMs(250 * (2 ** (attempt - 1)) + Math.round(Math.random() * 100));
        }
      }
      if (!uploaded) throw new Error("Не удалось загрузить видеокружок");

      let sent = null as Awaited<ReturnType<typeof sendMessage>> | null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          sent = await sendMessage(chatId, {
            type: "video_note",
            content: uploaded.url,
            folderId: folderId ?? undefined,
          });
          break;
        } catch (err) {
          if (err instanceof ChatRequestError && err.status >= 400 && err.status < 500 && err.status !== 429) {
            throw err;
          }
          if (attempt === 2) throw err;
          await delayMs(300 + Math.round(Math.random() * 120));
        }
      }
      if (!sent) throw new Error("Не удалось отправить видеокружок");

      setMessages((prev) =>
        prev.map((m) =>
          m.id === localId
            ? {
                id: sent.id,
                chatId,
                senderId: user.id,
                type: "video_note" as const,
                content: sent.content,
                videoPosterUrl: sent.videoPosterUrl ?? uploaded.posterUrl ?? null,
                createdAt: sent.createdAt,
                sendStatus: "sent" as const,
              }
            : m,
        ),
      );
      URL.revokeObjectURL(displayUrl);
      emitVideoNoteMetric("send_success", { chatId, localId, blobSize: blob.size });
      setVideoNoteStage("idle");
    } catch (err) {
      URL.revokeObjectURL(displayUrl);
      if (isAbortError(err)) {
        setVideoNoteStage("idle");
        return;
      }
      let queued = false;
      if (!isLikelyOnline()) {
        queued = await pushQueuedVideoNote();
      }
      if (queued) {
        setVideoNoteStage("idle");
        return;
      }
      const title = humanizeUploadOrNetworkError(err, "Видеокружок не отправлен");
      setVideoNoteError(title);
      setVideoNoteStage("error");
      emitVideoNoteMetric("send_failed", {
        chatId,
        localId,
        blobSize: blob.size,
        error: err instanceof Error ? err.message : String(err),
      });
      toast({ title, variant: "destructive" });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === localId ? { ...m, sendStatus: "failed" as const, localUploadProgress: undefined } : m,
        ),
      );
      setTimeout(() => setVideoNoteStage("idle"), 0);
    } finally {
      if (videoNoteSendAbortRef.current === aborter) {
        videoNoteSendAbortRef.current = null;
      }
    }
  }, [user, chatId, folderId, cancelVideoNote, setMessages, toast, composerPulseOnOutgoingSentRef]);

  const handleVideoNotePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!videoNoteSupported || sendingMedia || isVideoNoteRecordingStage(videoNoteStage)) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    videoNotePressConsumedRef.current = false;
    setVideoNoteStage("holding");
    videoNotePointerStartYRef.current = e.clientY;
    videoNotePointerStartXRef.current = e.clientX;
    videoNotePointerActiveRef.current = true;
    videoNoteCancelTriggeredRef.current = false;
    setVideoNoteLockProgress(0);
    setVideoNoteCancelProgress(0);
    clearVideoNotePressTimer();
    videoNotePressTimerRef.current = setTimeout(() => {
      videoNotePressConsumedRef.current = true;
      triggerLightHaptic();
      void startVideoNoteRecording();
    }, VIDEO_NOTE_PRESS_MS);
  }, [videoNoteSupported, sendingMedia, videoNoteStage, clearVideoNotePressTimer, startVideoNoteRecording]);

  const handleVideoNotePointerUp = useCallback(async (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    clearVideoNotePressTimer();
    videoNotePointerActiveRef.current = false;
    videoNotePointerStartYRef.current = null;
    videoNotePointerStartXRef.current = null;
    setVideoNoteCancelProgress(0);
    if (isVideoNoteRecordingStage(videoNoteStage) && !videoNoteLocked) {
      await stopVideoNoteRecording();
      return;
    }
    if (videoNoteStage === "holding") setVideoNoteStage("idle");
  }, [clearVideoNotePressTimer, videoNoteStage, videoNoteLocked, stopVideoNoteRecording]);

  const handleVideoNotePointerMove = useCallback((e: React.PointerEvent) => {
    if (!videoNotePointerActiveRef.current) return;
    if (!isVideoNoteRecordingStage(videoNoteStage) || videoNoteLocked) return;
    const startY = videoNotePointerStartYRef.current;
    const startX = videoNotePointerStartXRef.current;
    if (startY == null) return;
    const deltaUp = startY - e.clientY;
    const deltaLeft = startX != null ? Math.max(0, startX - e.clientX) : 0;
    setVideoNoteLockProgress(Math.max(0, Math.min(1, deltaUp / VIDEO_NOTE_LOCK_DELTA_PX)));
    setVideoNoteCancelProgress(Math.max(0, Math.min(1, deltaLeft / VIDEO_NOTE_CANCEL_DELTA_PX)));
    if (deltaLeft >= VIDEO_NOTE_CANCEL_DELTA_PX && !videoNoteCancelTriggeredRef.current) {
      videoNoteCancelTriggeredRef.current = true;
      triggerLightHaptic();
      cancelVideoNote();
      return;
    }
    if (deltaUp >= VIDEO_NOTE_LOCK_DELTA_PX) {
      setVideoNoteLocked(true);
      setVideoNoteStage((prev) => withVideoNoteLock(prev, true));
      setVideoNoteLockProgress(1);
      setVideoNoteCancelProgress(0);
      triggerLightHaptic();
    }
  }, [videoNoteStage, videoNoteLocked, cancelVideoNote]);

  const handleVideoNotePointerLeave = useCallback(() => {
    if (!isVideoNoteRecordingStage(videoNoteStage)) {
      clearVideoNotePressTimer();
      videoNotePointerActiveRef.current = false;
      videoNotePointerStartYRef.current = null;
      videoNotePointerStartXRef.current = null;
      setVideoNoteLockProgress(0);
      setVideoNoteCancelProgress(0);
      if (videoNoteStage === "holding") setVideoNoteStage("idle");
    }
  }, [clearVideoNotePressTimer, videoNoteStage]);

  const handleVideoNoteButtonClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (videoNotePressConsumedRef.current) {
      videoNotePressConsumedRef.current = false;
      return;
    }
    if (isVideoNoteRecordingStage(videoNoteStage)) return;
    videoNoteInputRef.current?.click();
  }, [videoNoteStage]);

  useEffect(() => {
    if (!isVideoNoteRecordingStage(videoNoteStage) || !videoNoteSoftLight) return;
    void boostScreenBrightnessForVideoNote();
    return () => {
      void restoreScreenBrightnessAfterVideoNote();
    };
  }, [videoNoteStage, videoNoteSoftLight]);

  const VOICE_PRESS_MS = 300;

  useEffect(() => {
    revokeVoicePreview();
    cancelVideoNote();
    // Сброс медиа при смене чата; колбэки стабильны по смыслу операции
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только chatId
  }, [chatId]);

  useEffect(() => {
    return () => {
      clearVideoNotePressTimer();
      clearVideoNoteTimer();
      stopVideoNoteStream();
      clearVideoNoteMirrorPipeline();
      const recorder = videoNoteRecorderRef.current;
      if (recorder && recorder.state === "recording") {
        try {
          recorder.stop();
        } catch {}
      }
      const preview = videoNotePreviewUrl;
      if (preview) scheduleRevokeObjectURL(preview);
      void restoreScreenBrightnessAfterVideoNote();
    };
  }, [clearVideoNotePressTimer, clearVideoNoteMirrorPipeline, clearVideoNoteTimer, stopVideoNoteStream, videoNotePreviewUrl]);

  useEffect(() => {
    return () => {
      revokeVoicePreview();
    };
  }, [revokeVoicePreview]);

  const clearVoicePressTimer = useCallback(() => {
    if (voicePressTimerRef.current) {
      clearTimeout(voicePressTimerRef.current);
      voicePressTimerRef.current = null;
    }
    voicePressStartedRef.current = false;
  }, []);

  const finishVoiceRecording = useCallback(
    async (_origin: "pointer" | "click"): Promise<void> => {
      if (voiceFinishingRef.current) return;
      voiceFinishingRef.current = true;
      try {
        const displayName = user ? [user.displayName, user.surname].filter(Boolean).join(" ") || null : null;
        if (chatId && displayName !== undefined) sendVoiceRecording(chatId, displayName, false);
        const { blob, durationSec: recordedSec } = await stopVoice();
        clearVoicePressTimer();
        if (!blob || blob.size === 0 || !user) return;
        setVoiceError(null);
        voiceBlobRef.current = blob;
        setVoicePreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setVoicePreviewDurationSec(Math.max(0, recordedSec));
      } finally {
        voiceFinishingRef.current = false;
      }
    },
    [user, chatId, sendVoiceRecording, stopVoice, clearVoicePressTimer]
  );

  const cancelVoicePreview = useCallback(() => {
    revokeVoicePreview();
  }, [revokeVoicePreview]);

  const rerecordVoiceFromPreview = useCallback(async () => {
    if (!voiceSupported || !user || !chatId) return;
    requestPauseChatMessageMediaPlayback();
    revokeVoicePreview();
    setVoiceError(null);
    triggerLightHaptic();
    await startVoice();
    const displayName = [user.displayName, user.surname].filter(Boolean).join(" ") || null;
    if (displayName !== undefined) sendVoiceRecording(chatId, displayName, true);
  }, [voiceSupported, user, chatId, revokeVoicePreview, startVoice, sendVoiceRecording]);

  const sendRecordedVoice = useCallback(async () => {
    if (sendingVoiceLockRef.current || !user || !chatId) return;
    const blob = voiceBlobRef.current;
    if (!blob || blob.size === 0) return;
    sendingVoiceLockRef.current = true;
    setSendingVoice(true);
    setVoiceError(null);

    const pushQueuedVoice = async (): Promise<boolean> => {
      const localId = newOutboxLocalId();
      const displayUrl = URL.createObjectURL(blob);
      const ok = await enqueueOutboxVoice({
        localId,
        chatId,
        userId: user.id,
        folderId,
        blob,
      });
      if (!ok) {
        URL.revokeObjectURL(displayUrl);
        return false;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: localId,
          chatId,
          senderId: user.id,
          type: "voice",
          content: displayUrl,
          createdAt: new Date().toISOString(),
          sendStatus: "sending",
        },
      ]);
      playSendSound();
      composerPulseOnOutgoingSentRef?.current?.();
      revokeVoicePreview();
      toast({ title: "Нет сети", description: "Голосовое в очереди — отправим при появлении связи." });
      void flushChatOutbox();
      return true;
    };

    if (!isLikelyOnline()) {
      const ok = await pushQueuedVoice();
      if (!ok) {
        setVoiceError("Файл слишком большой или очередь переполнена");
        toast({ title: "Не удалось сохранить голосовое", variant: "destructive" });
      }
      setSendingVoice(false);
      sendingVoiceLockRef.current = false;
      return;
    }

    const localId = newOutboxLocalId();
    const displayUrl = URL.createObjectURL(blob);
    setMessages((prev) => [
      ...prev,
      {
        id: localId,
        chatId,
        senderId: user.id,
        type: "voice",
        content: displayUrl,
        createdAt: new Date().toISOString(),
        sendStatus: "sending" as const,
        localUploadProgress: 0,
      },
    ]);
    playSendSound();
    composerPulseOnOutgoingSentRef?.current?.();
    revokeVoicePreview();
    sendingVoiceLockRef.current = false;
    setSendingVoice(false);

    void (async () => {
      const blobToSend = blob;
      try {
        const url = await uploadVoice(blobToSend, {
          onProgress: (p) =>
            setMessages((prev) => prev.map((m) => (m.id === localId ? { ...m, localUploadProgress: p } : m))),
        });
        const sent = await sendMessage(chatId, { type: "voice", content: url, folderId: folderId ?? undefined });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === localId
              ? {
                  id: sent.id,
                  chatId,
                  senderId: user.id,
                  type: "voice" as const,
                  content: sent.content,
                  createdAt: sent.createdAt,
                  sendStatus: "sent" as const,
                }
              : m,
          ),
        );
        URL.revokeObjectURL(displayUrl);
      } catch (err) {
        if (import.meta.env.DEV || typeof console !== "undefined") {
          console.error("[voice] upload/send failed:", err);
        }
        const ok = await pushQueuedVoice();
        if (ok) {
          setMessages((prev) => prev.filter((m) => m.id !== localId));
          URL.revokeObjectURL(displayUrl);
        } else {
          URL.revokeObjectURL(displayUrl);
          const failUrl = URL.createObjectURL(blobToSend);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === localId
                ? {
                    ...m,
                    content: failUrl,
                    sendStatus: "failed" as const,
                    localUploadProgress: undefined,
                  }
                : m,
            ),
          );
          const msg = humanizeUploadOrNetworkError(err, "Голосовое не отправлено");
          setVoiceError(msg);
          toast({ title: msg, variant: "destructive" });
        }
      }
    })();
  }, [user, chatId, folderId, revokeVoicePreview, setMessages, toast, composerPulseOnOutgoingSentRef]);

  const handleMicPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (voicePreviewUrl || voiceState === "recording" || !voiceSupported) return;
      voicePressTimerRef.current = setTimeout(async () => {
        voicePressTimerRef.current = null;
        voicePressStartedRef.current = true;
        setVoiceError(null);
        triggerLightHaptic();
        requestPauseChatMessageMediaPlayback();
        await startVoice();
        const displayName = user ? [user.displayName, user.surname].filter(Boolean).join(" ") || null : null;
        if (chatId && displayName !== undefined) sendVoiceRecording(chatId, displayName, true);
      }, VOICE_PRESS_MS);
    },
    [voicePreviewUrl, voiceState, voiceSupported, user, chatId, startVoice, sendVoiceRecording]
  );

  const handleMicPointerUp = useCallback(
    async (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (voiceState !== "recording") {
        clearVoicePressTimer();
        return;
      }
      await finishVoiceRecording("pointer");
    },
    [voiceState, clearVoicePressTimer, finishVoiceRecording]
  );

  const handleMicPointerLeave = useCallback(() => {
    if (voiceState === "recording" && voicePressStartedRef.current) {
      stopVoice();
      const displayName = user ? [user.displayName, user.surname].filter(Boolean).join(" ") || null : null;
      if (chatId && displayName !== undefined) sendVoiceRecording(chatId, displayName, false);
    }
    clearVoicePressTimer();
  }, [voiceState, user, chatId, sendVoiceRecording, stopVoice, clearVoicePressTimer]);

  const handleMicClick = useCallback(async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (voiceState === "recording") {
      await finishVoiceRecording("click");
    }
  }, [voiceState, finishVoiceRecording]);

  /** Сброс записи без предпросмотра (корзина в PULSE-панели) */
  const discardVoiceRecording = useCallback(async () => {
    clearVoicePressTimer();
    voicePressStartedRef.current = false;
    if (voiceState !== "recording") return;
    voiceFinishingRef.current = true;
    try {
      const displayName = user ? [user.displayName, user.surname].filter(Boolean).join(" ") || null : null;
      if (chatId && displayName !== undefined) sendVoiceRecording(chatId, displayName, false);
      await stopVoice();
      voiceBlobRef.current = null;
    } finally {
      voiceFinishingRef.current = false;
    }
  }, [voiceState, user, chatId, sendVoiceRecording, stopVoice, clearVoicePressTimer]);

  const sendSticker = useCallback(
    async (stickerId: string) => {
      if (!user?.id || !chatId || sendingLockRef.current || editingId) return;
      const sid = stickerId.trim();
      if (!sid) return;
      sendingLockRef.current = true;
      try {
        const content = JSON.stringify({ stickerId: sid });
        const sent = await sendMessage(chatId, {
          type: "sticker",
          content,
          folderId: folderId ?? undefined,
        });
        setMessages((prev) => {
          if (prev.some((m) => m.id === sent.id)) return prev;
          return [
            ...prev,
            {
              id: sent.id,
              chatId,
              senderId: user.id,
              type: "sticker",
              content: sent.content,
              createdAt: sent.createdAt,
              sendStatus: "sent" as const,
            },
          ];
        });
        playSendSound();
        composerPulseOnOutgoingSentRef?.current?.();
      } catch (err) {
        const msg =
          err instanceof ChatRequestError ? err.message : "Не удалось отправить стикер";
        toast({ title: msg, variant: "destructive" });
      } finally {
        sendingLockRef.current = false;
      }
    },
    [user?.id, chatId, folderId, editingId, setMessages, toast, composerPulseOnOutgoingSentRef],
  );

  return {
    message,
    setMessage,
    replyingTo,
    setReplyingTo,
    scheduledAt,
    setScheduledAt,
    editingId,
    setEditingId,
    handleCancelEdit,
    sending,
    sendingVoice,
    sendingMedia,
    mediaUploadPercent,
    voiceUploadPercent,
    voiceError,
    voiceState,
    voiceRecorderError,
    durationSec,
    startVoice,
    stopVoice,
    voiceSupported,
    voicePreviewUrl,
    voicePreviewDurationSec,
    cancelVoicePreview,
    rerecordVoiceFromPreview,
    sendRecordedVoice,
    handleSend,
    handleRetryFailedMessage,
    handleKeyPress,
    insertMentionAtPosition,
    handleAttachFile,
    handleAttachPdfFile,
    attachChatDocumentFile,
    handleDroppedFiles,
    handleAttachFromNative,
    handleVideoNoteFile,
    videoNoteStage,
    videoNoteState,
    videoNoteError,
    videoNoteDurationSec,
    videoNotePreviewUrl,
    videoNoteSupported,
    videoNoteLocked,
    videoNoteLockProgress,
    videoNoteCancelProgress,
    videoNoteFacingUser,
    videoNoteSoftLight,
    videoNoteBackgroundStream,
    setVideoNoteSoftLight,
    flipVideoNoteCamera,
    setVideoNoteLiveElement,
    startVideoNoteRecording,
    stopVideoNoteRecording,
    cancelVideoNote,
    sendRecordedVideoNote,
    handleVideoNoteButtonClick,
    handleVideoNotePointerDown,
    handleVideoNotePointerUp,
    handleVideoNotePointerMove,
    handleVideoNotePointerLeave,
    handleMicClick,
    handleMicPointerDown,
    handleMicPointerUp,
    handleMicPointerLeave,
    discardVoiceRecording,
    sendSticker,
    fileInputRef,
    pdfInputRef,
    videoNoteInputRef,
  };
}
