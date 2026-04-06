/**
 * JPEG-постеры для старых постовых видео (рядом с `.mp4`: тот же ключ в S3 или файл в uploads/posts).
 *
 * Требования: DATABASE_URL, ffmpeg; для S3 — те же переменные, что у сервера.
 *
 *   npm run backfill:post-video-posters -- --dry-run
 *   npm run backfill:post-video-posters -- --limit=20
 *
 * Без --dry-run: создаёт объекты `…/posts/<id>.jpg` или пишет на диск под `uploads/posts/`.
 */
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { getPool, closeDb } from "../server/db";
import {
  s3Configured,
  s3ObjectExists,
  getS3ObjectBuffer,
  uploadToS3WithKey,
  parseS3KeyFromPublicUrl,
} from "../server/upload/s3";
import { extractPosterJpegBufferFromVideoFile } from "../server/upload/story-video-transcode";

const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const maxCreate = limitArg ? Math.max(1, Number.parseInt(limitArg.slice("--limit=".length), 10) || 50) : 500;

const VIDEO_IN_POST_RE = /\.mp4(\?|#|$)/i;

function collectVideoUrls(imageUrl: string | null, mediaUrls: unknown): string[] {
  const out: string[] = [];
  if (imageUrl && VIDEO_IN_POST_RE.test(imageUrl)) out.push(imageUrl.trim());
  if (Array.isArray(mediaUrls)) {
    for (const u of mediaUrls) {
      if (typeof u === "string" && VIDEO_IN_POST_RE.test(u)) out.push(u.trim());
    }
  }
  return out;
}

function posterPathFromVideoUrl(videoUrl: string): string | null {
  const base = videoUrl.split("?")[0].split("#")[0];
  if (!/\.mp4$/i.test(base)) return null;
  return base.replace(/\.mp4$/i, ".jpg");
}

function tryLocalVideoPath(urlStr: string): string | null {
  const clean = urlStr.split("?")[0].split("#")[0];
  if (clean.startsWith("/uploads/posts/")) {
    return path.join(process.cwd(), clean.replace(/^\//, ""));
  }
  try {
    const u = new URL(clean);
    const i = u.pathname.indexOf("/uploads/posts/");
    if (i >= 0) return path.join(process.cwd(), u.pathname.slice(1));
  } catch {
    /* ignore */
  }
  return null;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const pool = getPool();
  const { rows } = await pool.query<{ image_url: string | null; media_urls: unknown }>(`
    SELECT image_url, media_urls FROM posts
    WHERE is_draft = false
      AND (
        (image_url IS NOT NULL AND image_url ILIKE '%.mp4%')
        OR (media_urls IS NOT NULL AND media_urls::text ILIKE '%.mp4%')
      )
  `);

  const seen = new Set<string>();
  const targets: string[] = [];
  for (const row of rows) {
    for (const u of collectVideoUrls(row.image_url, row.media_urls)) {
      const norm = u.split("?")[0].split("#")[0];
      if (seen.has(norm)) continue;
      seen.add(norm);
      targets.push(u);
    }
  }

  console.info(`[backfill-post-video-posters] unique .mp4 URLs in posts: ${targets.length}, dryRun=${dryRun}, maxOps=${maxCreate}`);

  let doneOps = 0;
  let skippedHasPoster = 0;
  let skippedUnknown = 0;
  let failed = 0;

  for (const videoUrl of targets) {
    if (doneOps >= maxCreate) break;

    const posterUrlHint = posterPathFromVideoUrl(videoUrl);
    if (!posterUrlHint) {
      skippedUnknown += 1;
      continue;
    }

    const localVideo = tryLocalVideoPath(videoUrl);
    if (localVideo) {
      const localPoster = localVideo.replace(/\.mp4$/i, ".jpg");
      if (await pathExists(localPoster)) {
        skippedHasPoster += 1;
        continue;
      }
      if (!(await pathExists(localVideo))) {
        console.warn("[skip] local video missing:", localVideo);
        skippedUnknown += 1;
        continue;
      }
      if (dryRun) {
        console.info("[dry-run] would write poster:", localPoster);
        doneOps += 1;
        continue;
      }
      try {
        const jpeg = await extractPosterJpegBufferFromVideoFile(localVideo);
        await fs.writeFile(localPoster, jpeg);
        console.info("[ok] local poster:", localPoster);
        doneOps += 1;
      } catch (e) {
        failed += 1;
        console.error("[fail] local", localVideo, e instanceof Error ? e.message : e);
      }
      continue;
    }

    if (!s3Configured) {
      skippedUnknown += 1;
      continue;
    }

    const videoKey = parseS3KeyFromPublicUrl(videoUrl.split("?")[0].split("#")[0]);
    if (!videoKey || !/\.mp4$/i.test(videoKey)) {
      skippedUnknown += 1;
      continue;
    }
    const posterKey = videoKey.replace(/\.mp4$/i, ".jpg");
    if (await s3ObjectExists(posterKey)) {
      skippedHasPoster += 1;
      continue;
    }

    if (dryRun) {
      console.info("[dry-run] would S3 PutObject:", posterKey);
      doneOps += 1;
      continue;
    }

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pv-poster-"));
    const tmpVideo = path.join(tmpDir, "in.mp4");
    try {
      await fs.mkdir(tmpDir, { recursive: true });
      const buf = await getS3ObjectBuffer(videoKey);
      await fs.writeFile(tmpVideo, buf);
      const jpeg = await extractPosterJpegBufferFromVideoFile(tmpVideo);
      await uploadToS3WithKey(posterKey, jpeg, "image/jpeg");
      console.info("[ok] S3 poster:", posterKey);
      doneOps += 1;
    } catch (e) {
      failed += 1;
      console.error("[fail] S3", videoKey, e instanceof Error ? e.message : e);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  console.info(
    `[backfill-post-video-posters] done ops=${doneOps} skippedHasPoster=${skippedHasPoster} skippedUnknown=${skippedUnknown} failed=${failed}`,
  );
  await closeDb();
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
