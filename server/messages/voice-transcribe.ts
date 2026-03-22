/**
 * Фоновая расшифровка голосовых и видеокружков (Vosk / тот же HTTP ASR, что групповые звонки).
 * Требует CALL_TRANSCRIPTS_ASR_URL (полный URL, например http://127.0.0.1:8099/transcribe).
 */
import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { transcribeAudioChunk } from "../call-transcripts/asr-provider";
import { storage } from "../storage";
import { notifyVoiceOrVideoNoteTranscript } from "../realtime/chat";
import type { Message } from "@shared/schema";

const ASR_LANG = process.env.VOICE_MESSAGE_ASR_LANGUAGE?.trim() || "ru-RU";
const MAX_DOWNLOAD_BYTES = 80 * 1024 * 1024;

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr?.slice(0, 400) || `ffmpeg exited ${code ?? "?"}`));
    });
  });
}

function contentToSafeLocalPath(content: string): string | null {
  const t = content.trim();
  if (!t.startsWith("/uploads/")) return null;
  const rel = t.replace(/^\/+/, "");
  if (!rel || rel.includes("..")) return null;
  return path.join(process.cwd(), rel);
}

async function readContentBytes(content: string): Promise<Buffer | null> {
  const t = content.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) {
    const res = await fetch(t);
    if (!res.ok) return null;
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_DOWNLOAD_BYTES) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_DOWNLOAD_BYTES) return null;
    return buf;
  }
  const disk = contentToSafeLocalPath(t);
  if (!disk || !fs.existsSync(disk)) return null;
  const st = fs.statSync(disk);
  if (!st.isFile() || st.size > MAX_DOWNLOAD_BYTES) return null;
  return fs.readFileSync(disk);
}

function guessMimeFromPath(p: string, kind: "voice" | "video_note"): string {
  const ext = path.extname(p.split("?")[0] || "").toLowerCase();
  if (kind === "video_note") {
    if (ext === ".webm") return "video/webm";
    if (ext === ".mov" || ext === ".qt") return "video/quicktime";
    return "video/mp4";
  }
  if (ext === ".m4a" || ext === ".mp4") return "audio/mp4";
  if (ext === ".ogg" || ext === ".oga") return "audio/ogg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".mp3") return "audio/mpeg";
  return "audio/webm";
}

async function bufferToWavMono16k(inputPath: string): Promise<Buffer | null> {
  const outPath = path.join(os.tmpdir(), `asr-${randomUUID()}.wav`);
  try {
    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "pcm_s16le",
      outPath,
    ]);
    const wav = fs.readFileSync(outPath);
    return wav;
  } catch {
    return null;
  } finally {
    try {
      fs.unlinkSync(outPath);
    } catch {
      /* ignore */
    }
  }
}

async function prepareAudioForAsr(
  raw: Buffer,
  contentUrl: string,
  kind: "voice" | "video_note",
): Promise<{ base64: string; mimeType: string } | null> {
  if (kind === "voice") {
    const mime = guessMimeFromPath(contentUrl, "voice");
    return { base64: raw.toString("base64"), mimeType: mime };
  }
  const extFromUrl = path.extname(contentUrl.split("?")[0] || "").toLowerCase() || ".webm";
  const tmpIn = path.join(os.tmpdir(), `vn-${randomUUID()}${extFromUrl}`);
  try {
    fs.writeFileSync(tmpIn, raw);
    const wav = await bufferToWavMono16k(tmpIn);
    if (!wav) return null;
    return { base64: wav.toString("base64"), mimeType: "audio/wav" };
  } finally {
    try {
      fs.unlinkSync(tmpIn);
    } catch {
      /* ignore */
    }
  }
}

function messageToPayload(msg: Message): Parameters<typeof notifyVoiceOrVideoNoteTranscript>[1] {
  const created = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt);
  return {
    id: msg.id,
    chatId: msg.chatId,
    senderId: msg.senderId,
    type: msg.type,
    content: msg.content,
    createdAt: Number.isNaN(created.getTime()) ? new Date().toISOString() : created.toISOString(),
    folderId: msg.folderId ?? undefined,
    replyToId: msg.replyToId ?? undefined,
    forwardedFromMessageId: msg.forwardedFromMessageId ?? undefined,
    forwardedFromSenderName: msg.forwardedFromSenderName ?? undefined,
    transcript: msg.transcript ?? undefined,
  };
}

export async function runVoiceOrVideoNoteTranscription(chatId: string, messageId: string): Promise<void> {
  if (!process.env.CALL_TRANSCRIPTS_ASR_URL?.trim()) return;

  const msg = await storage.getMessage(chatId, messageId);
  if (!msg || (msg.type !== "voice" && msg.type !== "video_note")) return;
  const existing = typeof msg.transcript === "string" ? msg.transcript.trim() : "";
  if (existing) return;

  const raw = await readContentBytes(msg.content);
  if (!raw || raw.length === 0) return;

  const prepared = await prepareAudioForAsr(raw, msg.content, msg.type === "video_note" ? "video_note" : "voice");
  if (!prepared) return;

  const asr = await transcribeAudioChunk({
    audioBase64: prepared.base64,
    mimeType: prepared.mimeType,
    language: ASR_LANG,
    callId: `chat:${chatId}:${messageId}`,
    speakerUserId: msg.senderId ?? "unknown",
  });
  const text = asr?.text?.trim() ?? "";
  if (!text) return;

  const updated = await storage.updateMessageTranscript(chatId, messageId, text);
  if (!updated) return;

  notifyVoiceOrVideoNoteTranscript(chatId, messageToPayload(updated));
}

export function scheduleVoiceOrVideoNoteTranscription(chatId: string, messageId: string): void {
  if (!process.env.DATABASE_URL) return;
  if (!process.env.CALL_TRANSCRIPTS_ASR_URL?.trim()) return;
  void runVoiceOrVideoNoteTranscription(chatId, messageId).catch((e) => {
    console.warn("[voice-transcribe]", messageId, e instanceof Error ? e.message : e);
  });
}
