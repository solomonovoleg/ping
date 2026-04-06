import fs from "fs/promises";
import path from "path";
import type { Dirent, Stats } from "fs";
import { statfs } from "node:fs/promises";
import type { Pool } from "pg";
import { s3Configured, probeS3BucketHead } from "../../upload/s3";
import { buildServerHostSnapshot, type ServerHostSnapshot } from "./host-snapshot";

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|3gp|3gpp|mkv|avi)$/i;

export type DiskMountStats = {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
};

export type DiskBreakdownRow = {
  id: string;
  label: string;
  section: "uploads" | "database" | "disk";
  bytes: number;
  files: number | null;
  pctOfDiskTotal: number | null;
  pctOfDiskFree: number | null;
};

export type DiskOpsReport = {
  generatedAt: string;
  cwd: string;
  uploadsDir: string;
  statfsPath: string;
  projectPath: string;
  s3Configured: boolean;
  /** Режим хранения новых медиа для интерпретации объёма uploads/ */
  mediaStorageMode: "s3" | "local";
  /** HeadBucket при OPS_DISK_S3_HEAD_BUCKET=1; иначе не выполняется */
  s3BucketProbe: { ran: false } | { ran: true; ok: true } | { ran: true; ok: false; error: string };
  mount: DiskMountStats | null;
  mountError: string | null;
  host: ServerHostSnapshot;
  rows: DiskBreakdownRow[];
};

function classifyPostStoryFile(fileName: string): "image" | "video" | "other" {
  if (VIDEO_EXT_RE.test(fileName)) return "video";
  if (IMAGE_EXT_RE.test(fileName)) return "image";
  return "other";
}

async function walkFiles(dir: string, onFile: (abs: string, st: Stats) => void): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walkFiles(full, onFile);
    } else if (e.isFile()) {
      try {
        const st = await fs.stat(full);
        onFile(path.normalize(full), st);
      } catch {
        /* skip */
      }
    }
  }
}

async function sumClassifiedDir(
  absDir: string,
  classify: (name: string) => "image" | "video" | "other"
): Promise<{ image: number; video: number; other: number; files: { image: number; video: number; other: number } }> {
  const out = {
    image: 0,
    video: 0,
    other: 0,
    files: { image: 0, video: 0, other: 0 },
  };
  await walkFiles(absDir, (full, st) => {
    const kind = classify(path.basename(full));
    out[kind] += st.size;
    out.files[kind] += 1;
  });
  return out;
}

async function totalDirBytes(absDir: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0;
  let files = 0;
  await walkFiles(absDir, (_full, st) => {
    bytes += st.size;
    files += 1;
  });
  return { bytes, files };
}

function extractUploadsSubPath(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("/uploads/")) {
    const rest = t.slice("/uploads/".length);
    return rest.split("/").filter((s) => s && s !== "." && s !== "..").join("/");
  }
  try {
    const u = new URL(t);
    const idx = u.pathname.indexOf("/uploads/");
    if (idx < 0) return null;
    const rest = u.pathname.slice(idx + "/uploads/".length);
    return rest.split("/").filter((s) => s && s !== "." && s !== "..").join("/");
  } catch {
    return null;
  }
}

function absUploadPath(cwd: string, uploadsSubPath: string): string {
  const segs = uploadsSubPath.split("/").filter((s) => s && s !== "." && s !== "..");
  return path.normalize(path.join(cwd, "uploads", ...segs));
}

async function tryStatfsPath(p: string): Promise<{ ok: DiskMountStats } | { err: string }> {
  try {
    const s = await statfs(p);
    const bsize = Number(s.bsize);
    const blocks = Number(s.blocks);
    const bavail = Number(s.bavail);
    const totalBytes = bsize * blocks;
    const freeBytes = bsize * bavail;
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    return { ok: { totalBytes, freeBytes, usedBytes } };
  } catch (e) {
    return { err: e instanceof Error ? e.message : String(e) };
  }
}

function pct(part: number, whole: number): number | null {
  if (!whole || !Number.isFinite(whole) || whole <= 0) return null;
  return (part / whole) * 100;
}

function row(
  id: string,
  label: string,
  section: DiskBreakdownRow["section"],
  bytes: number,
  files: number | null,
  mount: DiskMountStats | null
): DiskBreakdownRow {
  return {
    id,
    label,
    section,
    bytes,
    files,
    pctOfDiskTotal: mount ? pct(bytes, mount.totalBytes) : null,
    pctOfDiskFree: mount && mount.freeBytes > 0 ? pct(bytes, mount.freeBytes) : null,
  };
}

export async function computeDiskOpsReport(pool: Pool | null): Promise<DiskOpsReport> {
  const cwd = process.cwd();
  const uploadsDir = path.join(cwd, "uploads");
  const statfsPath = process.env.DISK_STATFS_PATH?.trim() || cwd;
  const projectPath = process.env.DISK_PROJECT_PATH?.trim() || cwd;

  let mount: DiskMountStats | null = null;
  let mountError: string | null = null;
  const sf = await tryStatfsPath(statfsPath);
  if ("ok" in sf) mount = sf.ok;
  else mountError = sf.err;

  const uploadsTreeAll = await totalDirBytes(uploadsDir);
  const duMsRaw = Number.parseInt(process.env.DISK_PROJECT_DU_TIMEOUT_MS?.trim() || "", 10);
  const duTimeoutMs = Number.isFinite(duMsRaw) && duMsRaw >= 1000 ? duMsRaw : undefined;
  const host = await buildServerHostSnapshot({
    projectPath,
    mount,
    uploadsDirBytes: uploadsTreeAll.bytes,
    ...(duTimeoutMs != null ? { duTimeoutMs } : {}),
  });

  const postsDir = path.join(uploadsDir, "posts");
  const storiesDir = path.join(uploadsDir, "stories");
  const chatDir = path.join(uploadsDir, "chat");
  const avatarsDir = path.join(uploadsDir, "avatars");
  const coversDir = path.join(uploadsDir, "covers");
  const voiceDir = path.join(uploadsDir, "voice");

  const posts = await sumClassifiedDir(postsDir, classifyPostStoryFile);
  const stories = await sumClassifiedDir(storiesDir, classifyPostStoryFile);

  const avatarsT = await totalDirBytes(avatarsDir);
  const coversT = await totalDirBytes(coversDir);
  const voiceT = await totalDirBytes(voiceDir);
  const chatDirTotal = await totalDirBytes(chatDir);

  let chatImage = 0;
  let chatVideo = 0;
  let chatVideoNote = 0;
  let chatAvatarGroup = 0;
  let chatImageFiles = 0;
  let chatVideoFiles = 0;
  let chatVideoNoteFiles = 0;
  let chatGroupAvatarFiles = 0;
  const seenChatPaths = new Map<string, "image" | "video" | "video_note" | "group_avatar">();

  async function addPath(kind: "image" | "video" | "video_note" | "group_avatar", content: string | null) {
    if (!content) return;
    const sub = extractUploadsSubPath(content);
    if (!sub || !sub.startsWith("chat/")) return;
    const abs = absUploadPath(cwd, sub);
    if (seenChatPaths.has(abs)) return;
    try {
      const st = await fs.stat(abs);
      if (!st.isFile()) return;
      seenChatPaths.set(abs, kind);
      const sz = st.size;
      if (kind === "image") {
        chatImage += sz;
        chatImageFiles += 1;
      } else if (kind === "video") {
        chatVideo += sz;
        chatVideoFiles += 1;
      } else if (kind === "video_note") {
        chatVideoNote += sz;
        chatVideoNoteFiles += 1;
      } else {
        chatAvatarGroup += sz;
        chatGroupAvatarFiles += 1;
      }
    } catch {
      /* missing file */
    }
  }

  if (pool) {
    try {
      const r = await pool.query<{ type: string; content: string }>(
        `SELECT type::text AS type, content FROM messages
         WHERE type IN ('image','video','video_note') AND content IS NOT NULL AND length(content) < 4096`
      );
      for (const row of r.rows) {
        const t = row.type;
        if (t === "image") await addPath("image", row.content);
        else if (t === "video") await addPath("video", row.content);
        else if (t === "video_note") await addPath("video_note", row.content);
      }
    } catch (e) {
      console.error("[disk-stats] messages query", e);
    }

    try {
      const r2 = await pool.query<{ avatar_url: string }>(
        `SELECT DISTINCT avatar_url FROM chats
         WHERE avatar_url IS NOT NULL
           AND (avatar_url LIKE '/uploads/chat/%' OR avatar_url LIKE '%/uploads/chat/%')`
      );
      for (const row of r2.rows) {
        await addPath("group_avatar", row.avatar_url);
      }
    } catch (e) {
      console.error("[disk-stats] chats avatars query", e);
    }
  }

  const classifiedChatBytes = chatImage + chatVideo + chatVideoNote + chatAvatarGroup;
  const chatOrphanBytes = Math.max(0, chatDirTotal.bytes - classifiedChatBytes);
  const classifiedChatFiles =
    chatImageFiles + chatVideoFiles + chatVideoNoteFiles + chatGroupAvatarFiles;
  const chatOrphanFiles = Math.max(0, chatDirTotal.files - classifiedChatFiles);

  let uploadsMiscBytes = 0;
  let uploadsMiscFiles = 0;
  const known = new Set(["posts", "stories", "chat", "avatars", "covers", "voice"]);
  try {
    const top = await fs.readdir(uploadsDir, { withFileTypes: true });
    for (const e of top) {
      if (!e.isDirectory() || known.has(e.name)) continue;
      const t = await totalDirBytes(path.join(uploadsDir, e.name));
      uploadsMiscBytes += t.bytes;
      uploadsMiscFiles += t.files;
    }
  } catch {
    /* no uploads dir */
  }

  let dbTotal: number | null = null;
  let dbMessagesTable: number | null = null;
  let dbChatFoldersTable: number | null = null;
  let dbTextPayload: number | null = null;
  let dbTranscriptPayload: number | null = null;

  if (pool) {
    try {
      const q1 = await pool.query<{ s: string }>("SELECT pg_database_size(current_database())::text AS s");
      dbTotal = Number(q1.rows[0]?.s ?? NaN);
      if (!Number.isFinite(dbTotal)) dbTotal = null;
    } catch {
      dbTotal = null;
    }
    try {
      const q2 = await pool.query<{ s: string }>(
        "SELECT pg_total_relation_size('messages'::regclass)::text AS s"
      );
      dbMessagesTable = Number(q2.rows[0]?.s ?? NaN);
      if (!Number.isFinite(dbMessagesTable)) dbMessagesTable = null;
    } catch {
      dbMessagesTable = null;
    }
    try {
      const q3 = await pool.query<{ s: string }>(
        "SELECT pg_total_relation_size('chat_folders'::regclass)::text AS s"
      );
      dbChatFoldersTable = Number(q3.rows[0]?.s ?? NaN);
      if (!Number.isFinite(dbChatFoldersTable)) dbChatFoldersTable = null;
    } catch {
      dbChatFoldersTable = null;
    }
    try {
      const q4 = await pool.query<{ s: string }>(
        `SELECT coalesce(sum(length(content)), 0)::text AS s FROM messages
         WHERE type IN ('text','system','post_share','comment_share','story_reply')`
      );
      dbTextPayload = Number(q4.rows[0]?.s ?? NaN);
      if (!Number.isFinite(dbTextPayload)) dbTextPayload = null;
    } catch {
      dbTextPayload = null;
    }
    try {
      const q5 = await pool.query<{ s: string }>(
        `SELECT coalesce(sum(length(transcript)), 0)::text AS s FROM messages WHERE transcript IS NOT NULL`
      );
      dbTranscriptPayload = Number(q5.rows[0]?.s ?? NaN);
      if (!Number.isFinite(dbTranscriptPayload)) dbTranscriptPayload = null;
    } catch {
      dbTranscriptPayload = null;
    }
  }

  let dbRest: number | null = null;
  if (
    dbTotal != null &&
    dbMessagesTable != null &&
    dbChatFoldersTable != null
  ) {
    dbRest = Math.max(0, dbTotal - dbMessagesTable - dbChatFoldersTable);
  }

  const rows: DiskBreakdownRow[] = [];

  rows.push(row("post_photo", "Посты: фото", "uploads", posts.image, posts.files.image, mount));
  rows.push(row("post_video", "Посты: видео", "uploads", posts.video, posts.files.video, mount));
  rows.push(row("post_other", "Посты: прочее (аудио и др.)", "uploads", posts.other, posts.files.other, mount));

  rows.push(row("story_photo", "Сториз: фото", "uploads", stories.image, stories.files.image, mount));
  rows.push(row("story_video", "Сториз: видео", "uploads", stories.video, stories.files.video, mount));

  rows.push(row("chat_photo", "Чаты: фото в сообщениях", "uploads", chatImage, chatImageFiles, mount));
  rows.push(row("chat_video", "Чаты: видео", "uploads", chatVideo, chatVideoFiles, mount));
  rows.push(row("chat_video_note", "Чаты: видеокружки", "uploads", chatVideoNote, chatVideoNoteFiles, mount));
  rows.push(row("chat_group_avatar", "Чаты: аватары групп", "uploads", chatAvatarGroup, chatGroupAvatarFiles, mount));
  rows.push(row("chat_orphan", "Чаты: файлы без ссылки в БД", "uploads", chatOrphanBytes, chatOrphanFiles, mount));

  rows.push(row("voice", "Голосовые сообщения", "uploads", voiceT.bytes, voiceT.files, mount));
  rows.push(row("avatar_user", "Аватары пользователей", "uploads", avatarsT.bytes, avatarsT.files, mount));
  rows.push(row("cover", "Обложки профиля", "uploads", coversT.bytes, coversT.files, mount));

  rows.push(
    row("upload_misc", "Загрузки: прочие папки в uploads/", "uploads", uploadsMiscBytes, uploadsMiscFiles, mount)
  );

  if (dbMessagesTable != null) {
    rows.push(row("db_messages", "БД: таблица messages (данные + индексы)", "database", dbMessagesTable, null, mount));
  }
  if (dbTextPayload != null) {
    rows.push(
      row(
        "db_text_payload",
        "БД: объём текста в сообщениях (прибл., content)",
        "database",
        dbTextPayload,
        null,
        mount
      )
    );
  }
  if (dbTranscriptPayload != null && dbTranscriptPayload > 0) {
    rows.push(
      row("db_transcript", "БД: расшифровки голосовых/кружков (transcript)", "database", dbTranscriptPayload, null, mount)
    );
  }
  if (dbChatFoldersTable != null) {
    rows.push(row("db_folders", "БД: папки в групповых чатах (таблица)", "database", dbChatFoldersTable, null, mount));
  }
  if (dbTotal != null) {
    rows.push(row("db_total", "БД: вся база (pg_database_size)", "database", dbTotal, null, mount));
  }
  if (dbRest != null) {
    rows.push(row("db_rest", "БД: остальное (все таблицы − messages − chat_folders)", "database", dbRest, null, mount));
  }

  if (mount) {
    rows.push(
      row("disk_used", "Диск: занято на томе (statfs)", "disk", mount.usedBytes, null, mount),
      row("disk_free", "Диск: свободно на томе (statfs)", "disk", mount.freeBytes, null, mount)
    );
  }

  const mediaStorageMode: DiskOpsReport["mediaStorageMode"] = s3Configured ? "s3" : "local";
  const runS3Head =
    process.env.OPS_DISK_S3_HEAD_BUCKET === "1" || process.env.OPS_DISK_S3_HEAD_BUCKET === "true";
  let s3BucketProbe: DiskOpsReport["s3BucketProbe"] = { ran: false };
  if (runS3Head) {
    if (s3Configured) {
      const head = await probeS3BucketHead();
      s3BucketProbe = head.ok ? { ran: true, ok: true } : { ran: true, ok: false, error: head.error };
    } else {
      s3BucketProbe = { ran: true, ok: false, error: "S3 не настроен — проверка бакета не применима" };
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    cwd,
    uploadsDir,
    statfsPath,
    projectPath,
    s3Configured,
    mediaStorageMode,
    s3BucketProbe,
    mount,
    mountError,
    host,
    rows,
  };
}
