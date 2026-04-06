import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { getFfmpegExecutable } from "../lib/ffmpeg-bin";

const HEIC_MIME_RE = /^image\/hei[cf]$/i;
const HEIC_EXT_RE = /\.hei[cf]$/i;
/** iOS/WebView иногда шлёт image/heic для уже PNG/JPEG/WebP/GIF — не гоняем такие файлы через HEIC-пайплайн. */
const KNOWN_RASTER_EXT_RE = /\.(jpe?g|png|gif|webp)$/i;

export function isHeicLike(mimetype: string, originalname: string): boolean {
  const ext = path.extname(originalname || "");
  if (KNOWN_RASTER_EXT_RE.test(ext)) return false;
  const mime = (mimetype || "").toLowerCase().trim();
  if (HEIC_MIME_RE.test(mime)) return true;
  return HEIC_EXT_RE.test(ext);
}

/**
 * По первым байтам: явный PNG / JPEG / GIF / WebP.
 * Нужен, когда браузер шлёт image/heic без расширения .png в имени (типично iOS при выборе из галереи).
 */
export function bufferLooksLikeStandardRasterImage(buf: Buffer | undefined | null): boolean {
  if (!buf || buf.length < 12) return false;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return true;
  }
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") return true;
  return false;
}

/** Конвертировать в JPEG только если это действительно похоже на HEIC-поток, а не PNG под чужим MIME. */
export function shouldConvertHeicToJpeg(mimetype: string, originalname: string, buffer?: Buffer | null): boolean {
  if (buffer && bufferLooksLikeStandardRasterImage(buffer)) return false;
  return isHeicLike(mimetype, originalname);
}

export async function readFileHeadBytes(filePath: string, maxBytes: number): Promise<Buffer> {
  const n = Math.min(Math.max(1, maxBytes), 64);
  const h = await fs.open(filePath, "r");
  try {
    const buf = Buffer.alloc(n);
    const { bytesRead } = await h.read(buf, 0, n, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await h.close();
  }
}

export function sniffRasterMimeExt(buf: Buffer): { contentType: string; ext: string } | null {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { contentType: "image/png", ext: ".png" };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { contentType: "image/jpeg", ext: ".jpg" };
  }
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return { contentType: "image/gif", ext: ".gif" };
  }
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") {
    return { contentType: "image/webp", ext: ".webp" };
  }
  return null;
}

/** Клиент заявил HEIC, но байты — обычный растр. */
export function fixWrongHeicDeclaration(buffer: Buffer, mimetype: string): { contentType: string; ext: string } | null {
  const mime = (mimetype || "").toLowerCase().trim();
  if (!HEIC_MIME_RE.test(mime)) return null;
  if (!bufferLooksLikeStandardRasterImage(buffer)) return null;
  return sniffRasterMimeExt(buffer);
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(getFfmpegExecutable(), args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffmpeg exited with code ${code ?? "unknown"}`));
    });
  });
}

async function ffmpegHeicBufferToJpeg(buffer: Buffer): Promise<Buffer> {
  const dir = os.tmpdir();
  const id = randomUUID();
  const input = path.join(dir, `heic-in-${id}.heic`);
  const output = path.join(dir, `heic-out-${id}.jpg`);
  try {
    await fs.writeFile(input, buffer);
    await runFfmpeg([
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      input,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      output,
    ]);
    return await fs.readFile(output);
  } finally {
    await fs.unlink(input).catch(() => {});
    await fs.unlink(output).catch(() => {});
  }
}

/** JPEG из HEIC/HEIF: сначала sharp (ориентация EXIF), при ошибке — ffmpeg с libheif. */
export async function convertHeicBufferToJpeg(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer, { failOn: "none" })
      .rotate()
      .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" })
      .toBuffer();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[heic-convert] sharp failed, trying ffmpeg:", msg);
    return ffmpegHeicBufferToJpeg(buffer);
  }
}

export async function convertHeicFileToJpegFile(inputPath: string, outputJpegPath: string): Promise<void> {
  try {
    await sharp(inputPath, { failOn: "none" })
      .rotate()
      .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" })
      .toFile(outputJpegPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[heic-convert] sharp (file) failed, ffmpeg:", msg);
    const buf = await fs.readFile(inputPath);
    const jpeg = await ffmpegHeicBufferToJpeg(buf);
    await fs.writeFile(outputJpegPath, jpeg);
  }
}
