import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { uploadToS3, s3Configured } from "./s3-upload.js";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const UPLOADS_DIR = path.join(process.cwd(), "uploads", "posts");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function extFromContentType(ct: string): string {
  const c = ct.toLowerCase();
  if (c.includes("png")) return ".png";
  if (c.includes("webp")) return ".webp";
  if (c.includes("gif")) return ".gif";
  return ".jpg";
}

export async function importRemoteImageToPostStorage(imageUrl: string): Promise<string> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(imageUrl, {
      signal: ctrl.signal,
      headers: { "User-Agent": "PingMootVkParser/1.0" },
    });
    if (!res.ok) throw new Error(`Скачивание: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) throw new Error("Файл больше 15 МБ");
    const ct = res.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) throw new Error(`Ожидалось image/*, получено ${ct}`);
    const ext = extFromContentType(ct);
    if (s3Configured) {
      return uploadToS3("posts", buf, ct, ext);
    }
    ensureDir(UPLOADS_DIR);
    const name = `${randomUUID()}${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, name), buf);
    return `/uploads/posts/${name}`;
  } finally {
    clearTimeout(tid);
  }
}
