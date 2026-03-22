import { spawn } from "node:child_process";
import fs from "fs/promises";
import path from "path";
import os from "node:os";
import type { Dirent, Stats } from "fs";

export type DiskMountLike = {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
};

function pct(part: number, whole: number): number | null {
  if (!whole || !Number.isFinite(whole) || whole <= 0) return null;
  return (part / whole) * 100;
}

const SKIP_PROJECT_DIRS = new Set(["node_modules", ".git", ".pnpm-store"]);

async function walkProjectBytesSkipped(absRoot: string): Promise<number> {
  let bytes = 0;
  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_PROJECT_DIRS.has(e.name)) continue;
        await walk(full);
      } else if (e.isFile()) {
        try {
          const st: Stats = await fs.stat(full);
          bytes += st.size;
        } catch {
          /* skip */
        }
      }
    }
  }
  await walk(absRoot);
  return bytes;
}

/**
 * Быстрая оценка размера каталога через `du -sk` (POSIX). При неудаче — обход с пропуском node_modules/.git.
 */
export async function measureProjectDirBytes(
  absProjectPath: string,
  duTimeoutMs: number
): Promise<{ bytes: number; source: "du" | "walk_skipped" | "none"; error: string | null }> {
  const resolved = path.resolve(absProjectPath);
  try {
    const st = await fs.stat(resolved);
    if (!st.isDirectory()) {
      return { bytes: 0, source: "none", error: "Не каталог" };
    }
  } catch (e) {
    return {
      bytes: 0,
      source: "none",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const fromDu = await new Promise<number | null>((resolve) => {
    const child = spawn("du", ["-sk", resolved], { windowsHide: true });
    let out = "";
    const t = setTimeout(() => {
      child.kill("SIGKILL");
      resolve(null);
    }, duTimeoutMs);
    child.stdout?.on("data", (c: Buffer) => {
      out += c.toString();
    });
    child.on("error", () => {
      clearTimeout(t);
      resolve(null);
    });
    child.on("close", (code) => {
      clearTimeout(t);
      if (code !== 0) {
        resolve(null);
        return;
      }
      const m = out.trim().match(/^(\d+)/);
      if (!m) {
        resolve(null);
        return;
      }
      resolve(parseInt(m[1], 10) * 1024);
    });
  });

  if (fromDu != null && Number.isFinite(fromDu) && fromDu >= 0) {
    return { bytes: fromDu, source: "du", error: null };
  }

  try {
    const b = await walkProjectBytesSkipped(resolved);
    return { bytes: b, source: "walk_skipped", error: null };
  } catch (e) {
    return {
      bytes: 0,
      source: "none",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export type ServerHostSnapshot = {
  projectPath: string;
  projectDiskBytes: number | null;
  /** Как измеряли: du (всё дерево) или обход без node_modules/.git */
  projectDiskSource: "du" | "walk_skipped" | "none";
  projectDiskError: string | null;
  projectPctOfMountTotal: number | null;
  projectPctOfMountUsed: number | null;
  projectPctOfMountFree: number | null;
  /** uploads/ на диске (всё дерево) */
  uploadsDirBytes: number | null;
  /** Доля uploads от измеренной папки проекта */
  uploadsPctOfProjectDisk: number | null;

  memTotalBytes: number;
  memFreeBytes: number;
  memUsedBytes: number;
  memUsedPct: number;
  processRssBytes: number;
  processRssPctOfMemTotal: number | null;
  processRssPctOfMemUsed: number | null;
  /** RSS как доля от размера папки проекта на диске (если известен) */
  processRssPctOfProjectDisk: number | null;

  loadAvg1: number;
  loadAvg5: number;
  loadAvg15: number;
  cpuCount: number;
  /** load1 / cpuCount — «сколько ядер занято» в среднем */
  loadPerCore1: number | null;
};

export async function buildServerHostSnapshot(opts: {
  projectPath: string;
  mount: DiskMountLike | null;
  uploadsDirBytes: number;
  duTimeoutMs?: number;
}): Promise<ServerHostSnapshot> {
  /** По умолчанию короткий таймаут: иначе админка «висит» на больших деревьях; увеличьте DISK_PROJECT_DU_TIMEOUT_MS на VPS. */
  const duTimeoutMs = opts.duTimeoutMs ?? 12_000;
  const measured = await measureProjectDirBytes(opts.projectPath, duTimeoutMs);

  const mount = opts.mount;
  const proj = measured.source === "none" ? null : measured.bytes;

  const memTotal = os.totalmem();
  const memFree = os.freemem();
  const memUsed = Math.max(0, memTotal - memFree);
  const memUsedPct = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;

  const mu = process.memoryUsage();
  const rss = typeof mu.rss === "number" && Number.isFinite(mu.rss) ? mu.rss : 0;

  const cpus = os.cpus();
  const cpuCount = cpus?.length ?? 1;

  const [la1, la5, la15] = os.loadavg();
  const loadPerCore1 = cpuCount > 0 && Number.isFinite(la1) ? la1 / cpuCount : null;

  const uploadsDirBytes = opts.uploadsDirBytes >= 0 ? opts.uploadsDirBytes : null;

  return {
    projectPath: path.resolve(opts.projectPath),
    projectDiskBytes: proj,
    projectDiskSource: measured.source,
    projectDiskError: measured.error,
    projectPctOfMountTotal: proj != null && mount ? pct(proj, mount.totalBytes) : null,
    projectPctOfMountUsed: proj != null && mount && mount.usedBytes > 0 ? pct(proj, mount.usedBytes) : null,
    projectPctOfMountFree: proj != null && mount && mount.freeBytes > 0 ? pct(proj, mount.freeBytes) : null,
    uploadsDirBytes,
    uploadsPctOfProjectDisk:
      uploadsDirBytes != null && proj != null && proj > 0 ? pct(uploadsDirBytes, proj) : null,

    memTotalBytes: memTotal,
    memFreeBytes: memFree,
    memUsedBytes: memUsed,
    memUsedPct,
    processRssBytes: rss,
    processRssPctOfMemTotal: memTotal > 0 ? pct(rss, memTotal) : null,
    processRssPctOfMemUsed: memUsed > 0 ? pct(rss, memUsed) : null,
    processRssPctOfProjectDisk: proj != null && proj > 0 ? pct(rss, proj) : null,

    loadAvg1: la1,
    loadAvg5: la5,
    loadAvg15: la15,
    cpuCount,
    loadPerCore1,
  };
}
