import "dotenv/config";
import { closeDb, getDb } from "../db/client";
import { getFeedAlgoConfig } from "../feed/config";
import { computeGlobalPublicFeedOrderedIds } from "../feed/rank-global-public-feed";
import { saveFeedGlobalSnapshot } from "../feed/snapshot-store";

function intervalSec(): number {
  const raw = process.env.FEED_WORKER_INTERVAL_SEC?.trim();
  if (!raw) return 90;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 15 ? n : 90;
}

async function tick(): Promise<void> {
  const db = getDb();
  const algo = getFeedAlgoConfig();
  const { ids, candidateCount } = await computeGlobalPublicFeedOrderedIds(db, algo);
  await saveFeedGlobalSnapshot({
    postIds: ids,
    algoMode: algo.mode,
    candidateCount,
  });
  console.log(new Date().toISOString(), "[feed-worker] snapshot ok", {
    ordered: ids.length,
    candidates: candidateCount,
    mode: algo.mode,
  });
}

async function main(): Promise<void> {
  const once = process.env.FEED_WORKER_ONCE?.trim() === "1";
  await tick();
  if (once) {
    await closeDb();
    return;
  }
  setInterval(() => {
    tick().catch((e) => console.error("[feed-worker] tick failed", e));
  }, intervalSec() * 1000);
}

main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
