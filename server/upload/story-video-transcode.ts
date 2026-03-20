import { spawn } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";

const STORY_VIDEO_MAX_MB = 500;
const STORY_VIDEO_MAX_BYTES = STORY_VIDEO_MAX_MB * 1024 * 1024;
const VIDEO_MIME_RE = /^video\//i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|mkv|avi|m4v|3gp|wmv|flv|ts|m2ts|mts|ogv|mpeg|mpg)$/i;
const STORY_VIDEO_MAX_SECONDS = 14;
const OUTPUT_CONTENT_TYPE = "video/mp4";
const OUTPUT_EXT = ".mp4";
const STORY_VIDEO_FILTER =
  "scale='min(1080,iw)':-2:force_original_aspect_ratio=decrease,hqdn3d=1.1:1.0:2.5:2.2,eq=brightness=0.03:contrast=1.05:saturation=1.08,unsharp=3:3:0.25:3:3:0.12";
const STORY_AUDIO_FILTER =
  "highpass=f=80,lowpass=f=14000,acompressor=threshold=-18dB:ratio=2.5:attack=12:release=160,alimiter=limit=0.92,loudnorm=I=-16:LRA=11:TP=-1.5";

let ffmpegReadyPromise: Promise<void> | null = null;

type UploadFileLike = {
  size: number;
  mimetype?: string;
  originalname?: string;
};

function runCommand(cmd: string, args: string[]): Promise<{ stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stderr });
      else reject(new Error(stderr || `${cmd} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function ensureFfmpegReady(): Promise<void> {
  if (!ffmpegReadyPromise) {
    ffmpegReadyPromise = runCommand("ffmpeg", ["-version"]).then(() => undefined);
  }
  await ffmpegReadyPromise;
}

export function validateStoryVideoUpload(file: UploadFileLike): string | null {
  const mime = String(file.mimetype ?? "").trim();
  const name = String(file.originalname ?? "").trim();
  const byMime = VIDEO_MIME_RE.test(mime);
  const byExt = VIDEO_EXT_RE.test(name);
  if (!byMime && !byExt) {
    return "Не удалось определить видеофайл. Выберите видео из галереи или файлов";
  }
  if (file.size > STORY_VIDEO_MAX_BYTES) {
    return `Видео для сториз должно быть не больше ${STORY_VIDEO_MAX_MB} МБ`;
  }
  return null;
}

async function transcodeToStreamableMp4(inputPath: string, outputPath: string): Promise<void> {
  await ensureFfmpegReady();
  const args = [
    "-y",
    "-i",
    inputPath,
    "-t",
    String(STORY_VIDEO_MAX_SECONDS),
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-profile:v",
    "main",
    "-level",
    "4.0",
    "-pix_fmt",
    "yuv420p",
    "-vf",
    STORY_VIDEO_FILTER,
    "-r",
    "30",
    "-c:a",
    "aac",
    "-af",
    STORY_AUDIO_FILTER,
    "-b:a",
    "128k",
    "-ac",
    "2",
    "-ar",
    "48000",
    "-b:v",
    "2500k",
    "-maxrate",
    "3000k",
    "-bufsize",
    "6000k",
    "-movflags",
    "+faststart",
    outputPath,
  ];
  await runCommand("ffmpeg", args);
}

export async function transcodeStoryVideoBuffer(input: Buffer, inputExt = ".mp4"): Promise<{
  buffer: Buffer;
  ext: string;
  contentType: string;
}> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "story-video-"));
  const inPath = path.join(tempDir, `${randomUUID()}${inputExt || ".mp4"}`);
  const outPath = path.join(tempDir, `${randomUUID()}${OUTPUT_EXT}`);
  try {
    await fs.writeFile(inPath, input);
    await transcodeToStreamableMp4(inPath, outPath);
    const buffer = await fs.readFile(outPath);
    return { buffer, ext: OUTPUT_EXT, contentType: OUTPUT_CONTENT_TYPE };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function transcodeStoryVideoFileToPath(inputPath: string, targetDir: string): Promise<string> {
  const outPath = path.join(targetDir, `${randomUUID()}${OUTPUT_EXT}`);
  await transcodeToStreamableMp4(inputPath, outPath);
  return outPath;
}
