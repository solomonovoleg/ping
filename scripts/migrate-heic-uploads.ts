/**
 * Перекодирование уже загруженных HEIC/HEIF в JPEG на диске (uploads/posts|stories|chat|covers|avatars)
 * и замена URL в БД. S3: объекты нужно конвертировать отдельно (локальных файлов нет).
 *
 * Требования: те же, что у сервера — sharp (prebuild) и/или ffmpeg с libheif.
 *
 *   npm run migrate:heic-uploads -- --dry-run
 *   npm run migrate:heic-uploads
 *
 * Опционально: PUBLIC_BASE_URL=https://pingos.ru — заменить и абсолютные URL в БД.
 */
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { getPool } from "../server/db";
import { convertHeicFileToJpegFile } from "../server/upload/heic-convert";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const FOLDERS = ["posts", "stories", "chat", "covers", "avatars"] as const;

const dryRun = process.argv.includes("--dry-run");

function publicUrlBases(): string[] {
  const raw = [process.env.PUBLIC_BASE_URL, process.env.SITE_URL, process.env.API_PUBLIC_URL].filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );
  const bases = new Set<string>();
  for (const r of raw) {
    bases.add(r.replace(/\/+$/, ""));
  }
  return Array.from(bases);
}

function replacementPairs(folder: string, stem: string): [string, string][] {
  const exts = [".heic", ".heif", ".HEIC", ".HEIF"];
  const out: [string, string][] = [];
  const relNew = `/uploads/${folder}/${stem}.jpg`;
  for (const e of exts) {
    out.push([`/uploads/${folder}/${stem}${e}`, relNew]);
  }
  for (const base of publicUrlBases()) {
    for (const e of exts) {
      out.push([`${base}/uploads/${folder}/${stem}${e}`, `${base}${relNew}`]);
    }
  }
  return out;
}

function applyAllReplacements(s: string, pairs: [string, string][]): string {
  let t = s;
  for (const [from, to] of pairs) {
    if (t.includes(from)) t = t.split(from).join(to);
  }
  return t;
}

async function listHeicFiles(dir: string): Promise<string[]> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  return names.filter((n) => /\.hei[cf]$/i.test(n));
}

async function main() {
  const pool = getPool();
  const allPairs: [string, string][] = [];

  try {
    for (const folder of FOLDERS) {
      const dir = path.join(UPLOAD_ROOT, folder);
      const files = await listHeicFiles(dir);
      for (const name of files) {
        const stem = path.basename(name, path.extname(name));
        const inPath = path.join(dir, name);
        const outPath = path.join(dir, `${stem}.jpg`);
        const pairs = replacementPairs(folder, stem);
        allPairs.push(...pairs);

        if (dryRun) {
          console.log(`[dry-run] ${inPath} -> ${outPath}`);
          continue;
        }

        try {
          await convertHeicFileToJpegFile(inPath, outPath);
          await fs.unlink(inPath);
          console.log("Converted:", inPath);
        } catch (e) {
          console.error("Failed:", inPath, e);
          process.exitCode = 1;
          return;
        }
      }
    }

    const seenFrom = new Set<string>();
    const uniquePairs = allPairs.filter(([from]) => {
      if (seenFrom.has(from)) return false;
      seenFrom.add(from);
      return true;
    });

    if (dryRun) {
      console.log(`[dry-run] Would apply ${uniquePairs.length} URL replacement patterns in DB`);
      return;
    }

    if (uniquePairs.length === 0) {
      console.log("No HEIC files found under uploads/. Nothing to do.");
      return;
    }

    let n = 0;
    const runReplace = async (table: string, column: string) => {
      for (const [from, to] of uniquePairs) {
        const r = await pool.query(
          `UPDATE ${table} SET ${column} = REPLACE(${column}, $1, $2) WHERE ${column} IS NOT NULL AND strpos(${column}::text, $1) > 0`,
          [from, to],
        );
        n += r.rowCount ?? 0;
      }
    };

    await runReplace("posts", "image_url");
    await runReplace("stories", "media_url");
    await runReplace("users", "avatar_url");
    await runReplace("users", "cover_url");
    await runReplace("profile_pin_folders", "cover_url");
    await runReplace("profile_pin_items", "media_url");
    await runReplace("chats", "avatar_url");

    const { rows: postMediaRows } = await pool.query<{ id: string; media_urls: unknown }>(
      `SELECT id, media_urls FROM posts WHERE media_urls IS NOT NULL AND (media_urls::text ILIKE '%.heic%' OR media_urls::text ILIKE '%.heif%')`,
    );
    for (const row of postMediaRows) {
      const arr = row.media_urls;
      if (!Array.isArray(arr)) continue;
      const next = arr.map((u) => (typeof u === "string" ? applyAllReplacements(u, uniquePairs) : u));
      if (next.every((v, i) => v === arr[i])) continue;
      await pool.query(`UPDATE posts SET media_urls = $2::jsonb WHERE id = $1`, [row.id, JSON.stringify(next)]);
      n += 1;
    }

    const { rows: msgRows } = await pool.query<{ id: string; content: string }>(
      `SELECT id, content FROM messages WHERE content ILIKE '%.heic%' OR content ILIKE '%.heif%'`,
    );
    for (const row of msgRows) {
      const next = applyAllReplacements(row.content, uniquePairs);
      if (next === row.content) continue;
      await pool.query(`UPDATE messages SET content = $2 WHERE id = $1`, [row.id, next]);
      n += 1;
    }

    try {
      const { rows: vkRows } = await pool.query<{ id: string; media_urls: unknown }>(
        `SELECT id, media_urls FROM vk_parser_items WHERE media_urls IS NOT NULL AND (media_urls::text ILIKE '%.heic%' OR media_urls::text ILIKE '%.heif%')`,
      );
      for (const row of vkRows) {
        const arr = row.media_urls;
        if (!Array.isArray(arr)) continue;
        const next = arr.map((u) => (typeof u === "string" ? applyAllReplacements(u, uniquePairs) : u));
        if (next.every((v, i) => v === arr[i])) continue;
        await pool.query(`UPDATE vk_parser_items SET media_urls = $2::jsonb WHERE id = $1`, [row.id, JSON.stringify(next)]);
        n += 1;
      }
    } catch (e) {
      console.warn("Skip vk_parser_items (no table or error):", e instanceof Error ? e.message : e);
    }

    console.log("DB updates finished (row-level operations):", n);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
