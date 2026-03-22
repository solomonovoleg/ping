import { spawn } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { POST_VIDEO_MAX_SECONDS } from "@shared/post-video";

const STORY_VIDEO_MAX_MB = 500;
const STORY_VIDEO_MAX_BYTES = STORY_VIDEO_MAX_MB * 1024 * 1024;
const VIDEO_MIME_RE = /^video\//i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|mkv|avi|m4v|3gp|wmv|flv|ts|m2ts|mts|ogv|mpeg|mpg)$/i;
const OUTPUT_CONTENT_TYPE = "video/mp4";
const OUTPUT_EXT = ".mp4";
const POSTER_CONTENT_TYPE = "image/jpeg";
const POSTER_EXT = ".jpg";
const STORY_VIDEO_FILTER =
  "scale='min(1080,iw)':-2:force_original_aspect_ratio=decrease,hqdn3d=1.1:1.0:2.5:2.2,eq=brightness=0.03:contrast=1.05:saturation=1.08,unsharp=3:3:0.25:3:3:0.12";
/** Минимальный фильтр: работает на «урезанных» сборках ffmpeg без hqdn3d и т.п. */
const STORY_VIDEO_FILTER_SIMPLE = "scale='min(1080,iw)':-2:force_original_aspect_ratio=decrease";
const STORY_AUDIO_FILTER =
  "highpass=f=80,lowpass=f=14000,acompressor=threshold=-18dB:ratio=2.5:attack=12:release=160,alimiter=limit=0.92,loudnorm=I=-16:LRA=11:TP=-1.5";
const AVATAR_VIDEO_FILTER =
  "format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,scale='min(320,iw)':-2:force_original_aspect_ratio=decrease";
const AVATAR_VIDEO_FILTER_TINY =
  "format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,scale='min(240,iw)':-2:force_original_aspect_ratio=decrease";

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

export type VideoTranscodeTrim = {
  startSec: number;
  durationSec: number;
  /** Верхняя граница длины клипа (пост 14 с, аватар 4 с). По умолчанию POST_VIDEO_MAX_SECONDS. */
  maxSegmentSec?: number;
};

export type VideoTranscodeProfile = "default" | "avatar";

function buildFfmpegTranscodeArgs(
  inputPath: string,
  outputPath: string,
  startSec: number,
  durationSec: number,
  vf: string,
  withAudioFilter: boolean,
  opts: {
    forceR30: boolean;
    profileMain: boolean;
    includeAudio: boolean;
    videoBitrate: string;
    videoMaxRate: string;
    videoBufSize: string;
  },
): string[] {
  const args: string[] = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-ss",
    String(startSec),
    "-t",
    String(durationSec),
    "-map",
    "0:v:0",
  ];
  if (opts.includeAudio) {
    args.push("-map", "0:a:0?");
  }
  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-vf",
    vf,
  );
  if (opts.profileMain) {
    args.push("-profile:v", "main", "-level", "4.0");
  }
  if (opts.forceR30) {
    args.push("-r", "30");
  }
  if (opts.includeAudio) {
    args.push("-c:a", "aac");
    if (withAudioFilter) {
      args.push("-af", STORY_AUDIO_FILTER);
    }
    args.push("-b:a", "128k", "-ac", "2", "-ar", "48000");
  } else {
    args.push("-an");
  }
  args.push(
    "-b:v",
    opts.videoBitrate,
    "-maxrate",
    opts.videoMaxRate,
    "-bufsize",
    opts.videoBufSize,
    "-movflags",
    "+faststart",
    outputPath,
  );
  return args;
}

/** Чётные размеры + yuv420p (iPhone HDR/нечётные кадры без libx264-ошибок). */
const STORY_VIDEO_FILTER_SAFE =
  "format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,scale='min(1080,iw)':-2:force_original_aspect_ratio=decrease";

async function transcodeToStreamableMp4(
  inputPath: string,
  outputPath: string,
  trim?: VideoTranscodeTrim,
  profile: VideoTranscodeProfile = "default",
): Promise<void> {
  await ensureFfmpegReady();
  const cap = trim?.maxSegmentSec ?? POST_VIDEO_MAX_SECONDS;
  const startSec = trim != null ? Math.max(0, trim.startSec) : 0;
  const durationSec =
    trim != null ? Math.min(cap, Math.max(0.1, trim.durationSec)) : cap;

  const attempts: { label: string; args: string[] }[] =
    profile === "avatar"
      ? [
          {
            label: "avatar_primary",
            args: buildFfmpegTranscodeArgs(
              inputPath,
              outputPath,
              startSec,
              durationSec,
              AVATAR_VIDEO_FILTER,
              false,
              {
                forceR30: false,
                profileMain: true,
                includeAudio: false,
                videoBitrate: "420k",
                videoMaxRate: "520k",
                videoBufSize: "1040k",
              },
            ),
          },
          {
            label: "avatar_safe",
            args: buildFfmpegTranscodeArgs(
              inputPath,
              outputPath,
              startSec,
              durationSec,
              AVATAR_VIDEO_FILTER_TINY,
              false,
              {
                forceR30: false,
                profileMain: false,
                includeAudio: false,
                videoBitrate: "320k",
                videoMaxRate: "420k",
                videoBufSize: "840k",
              },
            ),
          },
          {
            label: "avatar_safe_pixel_scale",
            args: buildFfmpegTranscodeArgs(
              inputPath,
              outputPath,
              startSec,
              durationSec,
              AVATAR_VIDEO_FILTER_TINY,
              false,
              {
                forceR30: false,
                profileMain: false,
                includeAudio: false,
                videoBitrate: "260k",
                videoMaxRate: "340k",
                videoBufSize: "680k",
              },
            ),
          },
        ]
      : [
          {
            label: "premium",
            args: buildFfmpegTranscodeArgs(
              inputPath,
              outputPath,
              startSec,
              durationSec,
              STORY_VIDEO_FILTER,
              true,
              {
                forceR30: true,
                profileMain: true,
                includeAudio: true,
                videoBitrate: "2500k",
                videoMaxRate: "3000k",
                videoBufSize: "6000k",
              },
            ),
          },
          {
            label: "simple",
            args: buildFfmpegTranscodeArgs(
              inputPath,
              outputPath,
              startSec,
              durationSec,
              STORY_VIDEO_FILTER_SIMPLE,
              false,
              {
                forceR30: true,
                profileMain: true,
                includeAudio: true,
                videoBitrate: "2500k",
                videoMaxRate: "3000k",
                videoBufSize: "6000k",
              },
            ),
          },
          {
            label: "relaxed_no_r30",
            args: buildFfmpegTranscodeArgs(
              inputPath,
              outputPath,
              startSec,
              durationSec,
              STORY_VIDEO_FILTER_SIMPLE,
              false,
              {
                forceR30: false,
                profileMain: false,
                includeAudio: true,
                videoBitrate: "2500k",
                videoMaxRate: "3000k",
                videoBufSize: "6000k",
              },
            ),
          },
          {
            label: "video_only",
            args: buildFfmpegTranscodeArgs(
              inputPath,
              outputPath,
              startSec,
              durationSec,
              STORY_VIDEO_FILTER_SIMPLE,
              false,
              {
                forceR30: false,
                profileMain: false,
                includeAudio: false,
                videoBitrate: "2500k",
                videoMaxRate: "3000k",
                videoBufSize: "6000k",
              },
            ),
          },
          {
            label: "safe_pixel_scale",
            args: buildFfmpegTranscodeArgs(
              inputPath,
              outputPath,
              startSec,
              durationSec,
              STORY_VIDEO_FILTER_SAFE,
              false,
              {
                forceR30: false,
                profileMain: false,
                includeAudio: false,
                videoBitrate: "2500k",
                videoMaxRate: "3000k",
                videoBufSize: "6000k",
              },
            ),
          },
        ];

  let lastErr: unknown;
  for (const { label, args } of attempts) {
    try {
      await runCommand("ffmpeg", args);
      if (label !== "premium") {
        console.warn(`[story-video-transcode] used fallback pipeline: ${label}`);
      }
      return;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message.slice(0, 500) : String(err);
      console.warn(`[story-video-transcode] pipeline "${label}" failed:`, msg);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function extractPosterFrame(
  inputPath: string,
  outputPath: string,
  profile: VideoTranscodeProfile,
): Promise<void> {
  await ensureFfmpegReady();
  const vf = profile === "avatar" ? AVATAR_VIDEO_FILTER : STORY_VIDEO_FILTER_SAFE;
  const args = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    "0.05",
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-vf",
    vf,
    "-q:v",
    "4",
    outputPath,
  ];
  await runCommand("ffmpeg", args);
}

export async function transcodeStoryVideoBuffer(
  input: Buffer,
  inputExt = ".mp4",
  trim?: VideoTranscodeTrim,
  profile: VideoTranscodeProfile = "default",
): Promise<{
  buffer: Buffer;
  ext: string;
  contentType: string;
  posterBuffer?: Buffer;
  posterExt?: string;
  posterContentType?: string;
}> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "story-video-"));
  const inPath = path.join(tempDir, `${randomUUID()}${inputExt || ".mp4"}`);
  const outPath = path.join(tempDir, `${randomUUID()}${OUTPUT_EXT}`);
  const posterPath = path.join(tempDir, `${randomUUID()}${POSTER_EXT}`);
  try {
    await fs.writeFile(inPath, input);
    await transcodeToStreamableMp4(inPath, outPath, trim, profile);
    const buffer = await fs.readFile(outPath);
    if (profile === "avatar") {
      try {
        await extractPosterFrame(outPath, posterPath, profile);
        const posterBuffer = await fs.readFile(posterPath);
        return {
          buffer,
          ext: OUTPUT_EXT,
          contentType: OUTPUT_CONTENT_TYPE,
          posterBuffer,
          posterExt: POSTER_EXT,
          posterContentType: POSTER_CONTENT_TYPE,
        };
      } catch (err) {
        console.warn("[story-video-transcode] avatar poster extraction failed:", err);
      }
    }
    return { buffer, ext: OUTPUT_EXT, contentType: OUTPUT_CONTENT_TYPE };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function transcodeStoryVideoFileToPath(
  inputPath: string,
  targetDir: string,
  trim?: VideoTranscodeTrim,
  profile: VideoTranscodeProfile = "default",
): Promise<{ videoPath: string; posterPath?: string }> {
  const outPath = path.join(targetDir, `${randomUUID()}${OUTPUT_EXT}`);
  await transcodeToStreamableMp4(inputPath, outPath, trim, profile);
  if (profile === "avatar") {
    const posterPath = outPath.slice(0, -OUTPUT_EXT.length) + POSTER_EXT;
    try {
      await extractPosterFrame(outPath, posterPath, profile);
      return { videoPath: outPath, posterPath };
    } catch (err) {
      console.warn("[story-video-transcode] avatar poster extraction failed:", err);
    }
  }
  return { videoPath: outPath };
}
