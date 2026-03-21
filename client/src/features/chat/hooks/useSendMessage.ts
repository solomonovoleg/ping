/**
 * Хук: отправка текста, редактирование, повтор, вложения, голос. Макс. 300 строк.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { flushSync } from "react-dom";
import { useRealtimeContext } from "@/contexts/RealtimeContext";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { uploadVoice, uploadChatMedia, sendMessage } from "@/lib/chat";
import {
  enqueueOutboxText,
  enqueueOutboxVoice,
  flushChatOutbox,
  isLikelyOnline,
  newOutboxLocalId,
} from "@/lib/chat-outbox";
import { clearDraft } from "@/lib/chat-drafts";
import { compressImage } from "@/lib/compress-image";
import { API, apiFetch } from "@/lib/api-base";
import { triggerLightHaptic } from "@/lib/capacitor-native";
import { takePhotoFromCamera, pickPhotoFromGallery } from "@/lib/capacitor-native";
import { playSendSound } from "@/lib/send-sound";
import type { ApiMessage } from "../types";

export type UseSendMessageParams = {
  chatId: string;
  folderId?: string | null;
  setMessages: React.Dispatch<React.SetStateAction<ApiMessage[]>>;
  user: { id: string; displayName?: string | null; surname?: string | null } | null;
};

type VideoNoteState = "idle" | "recording" | "preview";

const VIDEO_NOTE_PRESS_MS = 260;
const VIDEO_NOTE_LOCK_DELTA_PX = 56;

function videoNoteExtension(mime: string): string {
  if (mime.includes("mp4")) return ".mp4";
  if (mime.includes("quicktime")) return ".mov";
  return ".webm";
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
    if (name === "NotReadableError") return "Устройство занято. Закройте другие приложения, использующие камеру.";
    if (name === "OverconstrainedError") return "Параметры камеры не поддерживаются на этом устройстве.";
  }
  return "Не удалось запустить запись видеокружка";
}

export function useSendMessage({ chatId, folderId, setMessages, user }: UseSendMessageParams) {
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
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [videoNoteState, setVideoNoteState] = useState<VideoNoteState>("idle");
  const [videoNoteError, setVideoNoteError] = useState<string | null>(null);
  const [videoNoteDurationSec, setVideoNoteDurationSec] = useState(0);
  const [videoNotePreviewUrl, setVideoNotePreviewUrl] = useState<string | null>(null);
  const [videoNoteLocked, setVideoNoteLocked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const videoNotePointerActiveRef = useRef(false);

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
      setSending(true);
      const idToEdit = editingId;
      let prevContent = "";
      setEditingId(null);
      setMessage("");
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
    setSending(true);
    const replyToMsg = replyingTo;
    setReplyingTo(null);
    const isScheduled = scheduledAt && scheduledAt > new Date();
    if (isScheduled) setScheduledAt(null);
    setMessage("");
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
            return prev.map((m) => m.id === localId ? { ...m, id: data.id, replyToId: data.replyToId ?? m.replyToId, createdAt: data.createdAt ?? m.createdAt, sendStatus: undefined as ApiMessage["sendStatus"] } : m);
          });
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
  }, [chatId, folderId, user, message, sending, replyingTo, editingId, scheduledAt, setMessages, toast]);

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
          setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, id: data.id, createdAt: data.createdAt ?? m.createdAt, sendStatus: undefined as ApiMessage["sendStatus"] } : m));
          playSendSound();
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
    [chatId, folderId, user, setMessages, toast]
  );

  const insertMentionAtPosition = useCallback(
    (start: number, end: number, text: string): number => {
      const newMsg = message.slice(0, start) + text + message.slice(end);
      const newCursor = start + text.length;
      setMessage(newMsg);
      return newCursor;
    },
    [message]
  );

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingId && e.key === "Escape") { e.preventDefault(); handleCancelEdit(); return; }
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    },
    [editingId, handleCancelEdit, handleSend]
  );

  const dataUrlToFile = useCallback(async (dataUrl: string, name = "photo.jpg"): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || "image/jpeg" });
  }, []);

  const handleAttachFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !user || !chatId) return;
      revokeVoicePreview();
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isImage && !isVideo) {
        toast({ title: "Разрешены только фото и видео", variant: "destructive" });
        return;
      }
      if (sendingMediaLockRef.current) return;
      sendingMediaLockRef.current = true;
      setSendingMedia(true);
      try {
        const toUpload = isImage ? await compressImage(file) : file;
        const url = await uploadChatMedia(toUpload);
        const type = isVideo ? "video" : "image";
        const sent = await sendMessage(chatId, { type, content: url, folderId: folderId ?? undefined });
        setMessages((prev) => {
          if (prev.some((m) => m.id === sent.id)) return prev;
          return [...prev, { id: sent.id, chatId, senderId: user.id, type, content: url, createdAt: sent.createdAt }];
        });
        playSendSound();
      } catch (err) {
        toast({ title: err instanceof Error ? err.message : "Не отправлено", variant: "destructive" });
      } finally {
        sendingMediaLockRef.current = false;
        setSendingMedia(false);
      }
    },
    [chatId, folderId, user?.id, toast, setMessages, revokeVoicePreview]
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
      try {
        const file = await dataUrlToFile(dataUrl);
        const toUpload = await compressImage(file);
        const url = await uploadChatMedia(toUpload);
        const sent = await sendMessage(chatId, { type: "image", content: url, folderId: folderId ?? undefined });
        setMessages((prev) => {
          if (prev.some((m) => m.id === sent.id)) return prev;
          return [...prev, { id: sent.id, chatId, senderId: user.id, type: "image", content: url, createdAt: sent.createdAt }];
        });
        playSendSound();
      } catch (err) {
        toast({ title: err instanceof Error ? err.message : "Не отправлено", variant: "destructive" });
      } finally {
        sendingMediaLockRef.current = false;
        setSendingMedia(false);
      }
    },
    [chatId, folderId, user?.id, toast, dataUrlToFile, setMessages, revokeVoicePreview]
  );

  const handleVideoNoteFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !user || !chatId) return;
      revokeVoicePreview();
      if (!file.type.startsWith("video/")) {
        toast({ title: "Нужен видеофайл для видеокружка", variant: "destructive" });
        return;
      }
      if (sendingMediaLockRef.current) return;
      sendingMediaLockRef.current = true;
      setSendingMedia(true);
      try {
        const url = await uploadChatMedia(file);
        const sent = await sendMessage(chatId, { type: "video_note", content: url, folderId: folderId ?? undefined });
        setMessages((prev) => [
          ...prev,
          { id: sent.id, chatId, senderId: user.id, type: "video_note", content: url, createdAt: sent.createdAt },
        ]);
        playSendSound();
      } catch (err) {
        toast({ title: err instanceof Error ? err.message : "Видеокружок не отправлен", variant: "destructive" });
      } finally {
        sendingMediaLockRef.current = false;
        setSendingMedia(false);
      }
    },
    [chatId, folderId, user?.id, setMessages, toast, revokeVoicePreview]
  );

  const startVideoNoteRecording = useCallback(async () => {
    if (!videoNoteSupported || videoNoteState === "recording" || sendingMedia) return;
    revokeVoicePreview();
    setVideoNoteError(null);
    revokeVideoNotePreview();
    videoNoteBlobRef.current = null;
    clearVideoNoteMirrorPipeline();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: true,
      });
      videoNoteStreamRef.current = stream;
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
      const width = Math.max(240, mirrorVideo.videoWidth || 720);
      const height = Math.max(240, mirrorVideo.videoHeight || 720);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Не удалось подготовить зеркальную запись видео");
      }
      const drawMirrorFrame = () => {
        ctx.save();
        ctx.clearRect(0, 0, width, height);
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(mirrorVideo, 0, 0, width, height);
        ctx.restore();
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
      setVideoNoteState("recording");
      setVideoNoteLocked(false);
      setVideoNoteDurationSec(0);
      videoNoteStartedAtRef.current = Date.now();
      clearVideoNoteTimer();
      videoNoteTimerRef.current = setInterval(() => {
        if (!videoNoteStartedAtRef.current) return;
        setVideoNoteDurationSec(Math.floor((Date.now() - videoNoteStartedAtRef.current) / 1000));
      }, 250);
    } catch (err) {
      stopVideoNoteStream();
      clearVideoNoteMirrorPipeline();
      clearVideoNoteTimer();
      setVideoNoteState("idle");
      setVideoNoteError(mapMediaAccessError(err));
    }
  }, [
    videoNoteSupported,
    videoNoteState,
    sendingMedia,
    revokeVoicePreview,
    revokeVideoNotePreview,
    clearVideoNoteMirrorPipeline,
    clearVideoNoteTimer,
    stopVideoNoteStream,
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
    videoNoteChunksRef.current = [];
    if (!blob || blob.size === 0) {
      setVideoNoteState("idle");
      setVideoNoteDurationSec(0);
      setVideoNoteLocked(false);
      return;
    }
    videoNoteBlobRef.current = blob;
    revokeVideoNotePreview();
    const objectUrl = URL.createObjectURL(blob);
    setVideoNotePreviewUrl(objectUrl);
    setVideoNoteState("preview");
    setVideoNoteLocked(false);
  }, [clearVideoNoteMirrorPipeline, clearVideoNoteTimer, stopVideoNoteStream, revokeVideoNotePreview]);

  const cancelVideoNote = useCallback(() => {
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
    setVideoNoteState("idle");
    setVideoNoteLocked(false);
    videoNotePointerStartYRef.current = null;
    videoNotePointerActiveRef.current = false;
    revokeVideoNotePreview();
  }, [clearVideoNotePressTimer, clearVideoNoteMirrorPipeline, clearVideoNoteTimer, stopVideoNoteStream, revokeVideoNotePreview]);

  const sendRecordedVideoNote = useCallback(async () => {
    if (sendingMediaLockRef.current || !user || !chatId) return;
    const blob = videoNoteBlobRef.current;
    if (!blob || blob.size === 0) return;
    sendingMediaLockRef.current = true;
    setSendingMedia(true);
    setVideoNoteError(null);
    try {
      const type = blob.type || "video/webm";
      const file = new File([blob], `video-note${videoNoteExtension(type)}`, { type });
      const url = await uploadChatMedia(file);
      const sent = await sendMessage(chatId, { type: "video_note", content: url, folderId: folderId ?? undefined });
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, { id: sent.id, chatId, senderId: user.id, type: "video_note", content: url, createdAt: sent.createdAt }];
      });
      playSendSound();
      cancelVideoNote();
    } catch (err) {
      setVideoNoteError(err instanceof Error ? err.message : "Видеокружок не отправлен");
      toast({ title: err instanceof Error ? err.message : "Видеокружок не отправлен", variant: "destructive" });
    } finally {
      sendingMediaLockRef.current = false;
      setSendingMedia(false);
    }
  }, [user, chatId, folderId, cancelVideoNote, setMessages, toast]);

  const handleVideoNotePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!videoNoteSupported || sendingMedia || videoNoteState === "recording") return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    videoNotePressConsumedRef.current = false;
    videoNotePointerStartYRef.current = e.clientY;
    videoNotePointerActiveRef.current = true;
    clearVideoNotePressTimer();
    videoNotePressTimerRef.current = setTimeout(() => {
      videoNotePressConsumedRef.current = true;
      triggerLightHaptic();
      void startVideoNoteRecording();
    }, VIDEO_NOTE_PRESS_MS);
  }, [videoNoteSupported, sendingMedia, videoNoteState, clearVideoNotePressTimer, startVideoNoteRecording]);

  const handleVideoNotePointerUp = useCallback(async (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    clearVideoNotePressTimer();
    videoNotePointerActiveRef.current = false;
    videoNotePointerStartYRef.current = null;
    if (videoNoteState === "recording" && !videoNoteLocked) {
      await stopVideoNoteRecording();
    }
  }, [clearVideoNotePressTimer, videoNoteState, videoNoteLocked, stopVideoNoteRecording]);

  const handleVideoNotePointerMove = useCallback((e: React.PointerEvent) => {
    if (!videoNotePointerActiveRef.current) return;
    if (videoNoteState !== "recording" || videoNoteLocked) return;
    const startY = videoNotePointerStartYRef.current;
    if (startY == null) return;
    const deltaUp = startY - e.clientY;
    if (deltaUp >= VIDEO_NOTE_LOCK_DELTA_PX) {
      setVideoNoteLocked(true);
      triggerLightHaptic();
    }
  }, [videoNoteState, videoNoteLocked]);

  const handleVideoNotePointerLeave = useCallback(() => {
    if (videoNoteState !== "recording") {
      clearVideoNotePressTimer();
      videoNotePointerActiveRef.current = false;
      videoNotePointerStartYRef.current = null;
    }
  }, [clearVideoNotePressTimer, videoNoteState]);

  const handleVideoNoteButtonClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (videoNotePressConsumedRef.current) {
      videoNotePressConsumedRef.current = false;
      return;
    }
    if (videoNoteState === "recording") return;
    videoNoteInputRef.current?.click();
  }, [videoNoteState]);

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
      if (preview) URL.revokeObjectURL(preview);
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

    try {
      const url = await uploadVoice(blob);
      const sent = await sendMessage(chatId, { type: "voice", content: url, folderId: folderId ?? undefined });
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, { id: sent.id, chatId, senderId: user.id, type: "voice", content: url, createdAt: sent.createdAt }];
      });
      playSendSound();
      revokeVoicePreview();
    } catch (err) {
      if (import.meta.env.DEV || typeof console !== "undefined") {
        console.error("[voice] upload/send failed:", err);
      }
      const ok = await pushQueuedVoice();
      if (!ok) {
        const msg = err instanceof Error ? err.message : "Ошибка отправки";
        setVoiceError(msg);
        toast({ title: msg || "Голосовое не отправлено", variant: "destructive" });
      }
    } finally {
      setSendingVoice(false);
      sendingVoiceLockRef.current = false;
    }
  }, [user, chatId, folderId, revokeVoicePreview, setMessages, toast]);

  const handleMicPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (voicePreviewUrl || voiceState === "recording" || sendingVoice || !voiceSupported) return;
      voicePressTimerRef.current = setTimeout(async () => {
        voicePressTimerRef.current = null;
        voicePressStartedRef.current = true;
        setVoiceError(null);
        triggerLightHaptic();
        await startVoice();
        const displayName = user ? [user.displayName, user.surname].filter(Boolean).join(" ") || null : null;
        if (chatId && displayName !== undefined) sendVoiceRecording(chatId, displayName, true);
      }, VOICE_PRESS_MS);
    },
    [voicePreviewUrl, voiceState, sendingVoice, voiceSupported, user, chatId, startVoice, sendVoiceRecording]
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
    handleAttachFromNative,
    handleVideoNoteFile,
    videoNoteState,
    videoNoteError,
    videoNoteDurationSec,
    videoNotePreviewUrl,
    videoNoteSupported,
    videoNoteLocked,
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
    fileInputRef,
    videoNoteInputRef,
  };
}
