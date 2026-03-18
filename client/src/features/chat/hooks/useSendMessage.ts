/**
 * Хук: отправка текста, редактирование, повтор, вложения, голос. Макс. 300 строк.
 */
import { useState, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { useCallContext } from "@/contexts/CallContext";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { uploadVoice, uploadChatMedia, sendMessage } from "@/lib/chat";
import { clearDraft } from "@/lib/chat-drafts";
import { compressImage } from "@/lib/compress-image";
import { API, apiFetch } from "@/lib/api-base";
import { triggerLightHaptic } from "@/lib/capacitor-native";
import { takePhotoFromCamera, pickPhotoFromGallery } from "@/lib/capacitor-native";
import { playSendSound } from "@/lib/send-sound";
import type { ApiMessage } from "../types";

export type UseSendMessageParams = {
  chatId: string;
  setMessages: React.Dispatch<React.SetStateAction<ApiMessage[]>>;
  user: { id: string; displayName?: string | null; surname?: string | null } | null;
};

export function useSendMessage({ chatId, setMessages, user }: UseSendMessageParams) {
  const { toast } = useToast();
  const { sendVoiceRecording } = useCallContext();
  const { state: voiceState, error: voiceRecorderError, durationSec, start: startVoice, stop: stopVoice, isSupported: voiceSupported } = useVoiceRecorder();

  const [message, setMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<ApiMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendingLockRef = useRef(false);
  const sendingMediaLockRef = useRef(false);
  const voicePressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voicePressStartedRef = useRef(false);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setMessage("");
  }, []);

  const handleSend = useCallback(async () => {
    const text = message.trim();
    if (!text || !user || sending || sendingLockRef.current) return;
    sendingLockRef.current = true;
    triggerLightHaptic();
    if (editingId) {
      setSending(true);
      const idToEdit = editingId;
      setEditingId(null);
      setMessage("");
      try {
        const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(idToEdit)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });
        if (res.ok) {
          const data = await res.json();
          setMessages((prev) => prev.map((m) => (m.id === idToEdit ? { ...m, content: data.content } : m)));
          toast({ title: "Изменения сохранены" });
        } else {
          const data = await res.json().catch(() => ({}));
          toast({ title: data.message ?? "Не удалось сохранить", variant: "destructive" });
          setMessage(text);
          setEditingId(idToEdit);
        }
      } catch {
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
    setMessage("");
    const replyToMsg = replyingTo;
    setReplyingTo(null);
    clearDraft(chatId);
    const tempId = `temp-${Date.now()}`;
    const optimistic: ApiMessage = {
      id: tempId, chatId, senderId: user.id, type: "text", content: text,
      replyToId: replyToMsg?.id ?? undefined,
      replyTo: replyToMsg ? { id: replyToMsg.id, senderId: replyToMsg.senderId, type: replyToMsg.type, content: replyToMsg.type === "text" ? replyToMsg.content.slice(0, 200) : replyToMsg.type } : undefined,
      createdAt: new Date().toISOString(), sendStatus: "sending",
    };
    flushSync(() => setMessages((prev) => [...prev, optimistic]));
    playSendSound();
    try {
      const body: { content: string; replyToId?: string } = { content: text };
      if (replyToMsg?.id) body.replyToId = replyToMsg.id;
      const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.id) {
        setMessages((prev) => {
          const alreadyHasReal = prev.some((m) => m.id === data.id);
          if (alreadyHasReal) return prev.filter((m) => m.id !== tempId);
          return prev.map((m) => m.id === tempId ? { ...m, id: data.id, replyToId: data.replyToId ?? m.replyToId, createdAt: data.createdAt ?? m.createdAt, sendStatus: undefined as ApiMessage["sendStatus"] } : m);
        });
      } else {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, sendStatus: "failed" as const } : m)));
        setMessage(text);
        const msg = (data && typeof data.message === "string" ? data.message : null) || "Не удалось отправить";
        toast({ title: msg, variant: "destructive" });
      }
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, sendStatus: "failed" as const } : m)));
      setMessage(text);
      toast({ title: "Нет сети", variant: "destructive" });
    } finally {
      setSending(false);
      sendingLockRef.current = false;
    }
  }, [chatId, user, message, sending, replyingTo, editingId, setMessages, toast]);

  const handleRetryFailedMessage = useCallback(
    async (msg: ApiMessage) => {
      if (msg.sendStatus !== "failed" || !user || msg.chatId !== chatId) return;
      const text = msg.content;
      flushSync(() => setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, sendStatus: "sending" as const } : m))));
      try {
        const body: { content: string; replyToId?: string } = { content: text };
        if (msg.replyToId) body.replyToId = msg.replyToId;
        const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/messages`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.id) {
          setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, id: data.id, createdAt: data.createdAt ?? m.createdAt, sendStatus: undefined as ApiMessage["sendStatus"] } : m));
          playSendSound();
        } else {
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, sendStatus: "failed" as const } : m)));
          toast({ title: "Не отправлено", variant: "destructive" });
        }
      } catch {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, sendStatus: "failed" as const } : m)));
        toast({ title: "Нет сети", variant: "destructive" });
      }
    },
    [chatId, user, setMessages, toast]
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
        const sent = await sendMessage(chatId, { type, content: url });
        setMessages((prev) => [...prev, { id: sent.id, chatId, senderId: user.id, type, content: url, createdAt: sent.createdAt }]);
        playSendSound();
      } catch (err) {
        toast({ title: err instanceof Error ? err.message : "Не отправлено", variant: "destructive" });
      } finally {
        sendingMediaLockRef.current = false;
        setSendingMedia(false);
      }
    },
    [chatId, user?.id, toast, setMessages]
  );

  const handleAttachFromNative = useCallback(
    async (source: "camera" | "gallery") => {
      if (!user || !chatId) return;
      if (sendingMediaLockRef.current) return;
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
        const sent = await sendMessage(chatId, { type: "image", content: url });
        setMessages((prev) => [...prev, { id: sent.id, chatId, senderId: user.id, type: "image", content: url, createdAt: sent.createdAt }]);
        playSendSound();
      } catch (err) {
        toast({ title: err instanceof Error ? err.message : "Не отправлено", variant: "destructive" });
      } finally {
        sendingMediaLockRef.current = false;
        setSendingMedia(false);
      }
    },
    [chatId, user?.id, toast, dataUrlToFile, setMessages]
  );

  const VOICE_PRESS_MS = 300;

  const clearVoicePressTimer = useCallback(() => {
    if (voicePressTimerRef.current) {
      clearTimeout(voicePressTimerRef.current);
      voicePressTimerRef.current = null;
    }
    voicePressStartedRef.current = false;
  }, []);

  const handleMicPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (voiceState === "recording" || sendingVoice || !voiceSupported) return;
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
    [voiceState, sendingVoice, voiceSupported, user, chatId, startVoice, sendVoiceRecording]
  );

  const handleMicPointerUp = useCallback(
    async (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (voiceState !== "recording") {
        clearVoicePressTimer();
        return;
      }
      const displayName = user ? [user.displayName, user.surname].filter(Boolean).join(" ") || null : null;
      if (chatId && displayName !== undefined) sendVoiceRecording(chatId, displayName, false);
      const blob = await stopVoice();
      clearVoicePressTimer();
      if (blob && blob.size > 0 && user) {
        setVoiceError(null);
        setSendingVoice(true);
        try {
          const url = await uploadVoice(blob);
          const sent = await sendMessage(chatId, { type: "voice", content: url });
          setMessages((prev) => [...prev, { id: sent.id, chatId, senderId: user.id, type: "voice", content: url, createdAt: sent.createdAt }]);
          playSendSound();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Ошибка отправки";
          if (import.meta.env.DEV || typeof console !== "undefined") {
            console.error("[voice] upload/send failed (release):", err);
          }
          setVoiceError(msg);
          toast({ title: msg || "Голосовое не отправлено", variant: "destructive" });
        } finally {
          setSendingVoice(false);
        }
      }
    },
    [voiceState, user, chatId, sendVoiceRecording, stopVoice, setMessages, toast, clearVoicePressTimer]
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
      const displayName = user ? [user.displayName, user.surname].filter(Boolean).join(" ") || null : null;
      if (chatId && displayName !== undefined) sendVoiceRecording(chatId, displayName, false);
      const blob = await stopVoice();
      if (blob && blob.size > 0 && user) {
        setVoiceError(null);
        setSendingVoice(true);
        try {
          const url = await uploadVoice(blob);
          const sent = await sendMessage(chatId, { type: "voice", content: url });
          setMessages((prev) => [...prev, { id: sent.id, chatId, senderId: user.id, type: "voice", content: url, createdAt: sent.createdAt }]);
          playSendSound();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Ошибка отправки";
          if (import.meta.env.DEV || typeof console !== "undefined") {
            console.error("[voice] upload/send failed (click stop):", err);
          }
          setVoiceError(msg);
          toast({ title: msg || "Голосовое не отправлено", variant: "destructive" });
        } finally {
          setSendingVoice(false);
        }
      }
    }
  }, [voiceState, user, chatId, sendVoiceRecording, stopVoice, setMessages, toast]);

  return {
    message,
    setMessage,
    replyingTo,
    setReplyingTo,
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
    handleSend,
    handleRetryFailedMessage,
    handleKeyPress,
    handleAttachFile,
    handleAttachFromNative,
    handleMicClick,
    handleMicPointerDown,
    handleMicPointerUp,
    handleMicPointerLeave,
    fileInputRef,
  };
}
