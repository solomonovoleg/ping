import type { EdgeMoneyTaskProgressItemDto } from "@/lib/edge-money-task-progress-api";
import type { EdgeLeaderboardPayload } from "@/lib/edge-participant";

const SNAP_VERSION = 2 as const;

export type EdgeMoneyVisitSnapshotV2 = {
  v: typeof SNAP_VERSION;
  lbKind: "primary" | "secondary";
  myXp: number;
  /** По ruleId */
  tasks: Record<string, { invPts?: number; followDone?: boolean }>;
};

export type EdgeMoneyRecapLine = { label: string; points: number };

export function edgeMoneyVisitStorageKey(userId: string, edgeId: string, lbKind: "primary" | "secondary"): string {
  return `edge:money:lastVisit:v${SNAP_VERSION}:${userId}:${edgeId}:${lbKind}`;
}

function myXpFromLeaderboard(lb: EdgeLeaderboardPayload): number {
  return lb.entries.find((e) => e.isMe)?.xp ?? 0;
}

export function buildMoneyVisitSnapshot(
  lb: EdgeLeaderboardPayload,
  tasks: EdgeMoneyTaskProgressItemDto[] | undefined,
  lbKind: "primary" | "secondary",
): EdgeMoneyVisitSnapshotV2 {
  const map: EdgeMoneyVisitSnapshotV2["tasks"] = {};
  for (const t of tasks ?? []) {
    map[t.ruleId] = {
      invPts: typeof t.invite?.pointsAwardedForInviteTask === "number" ? t.invite.pointsAwardedForInviteTask : undefined,
      followDone: t.followCompleted === true,
    };
  }
  return {
    v: SNAP_VERSION,
    lbKind,
    myXp: myXpFromLeaderboard(lb),
    tasks: map,
  };
}

export function readMoneyVisitSnapshot(raw: string | null): EdgeMoneyVisitSnapshotV2 | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as EdgeMoneyVisitSnapshotV2;
    if (j?.v !== SNAP_VERSION || (j.lbKind !== "primary" && j.lbKind !== "secondary")) return null;
    if (typeof j.myXp !== "number" || !j.tasks || typeof j.tasks !== "object") return null;
    return j;
  } catch {
    return null;
  }
}

/**
 * Сравнение снимка с прошлого захода и текущих данных.
 * Разбивка: приглашения (по сумме из invite-грантов), подписка, остаток — «прочие задания».
 */
export function computeMoneySessionRecap(
  prev: EdgeMoneyVisitSnapshotV2 | null,
  lb: EdgeLeaderboardPayload,
  tasks: EdgeMoneyTaskProgressItemDto[] | undefined,
  lbKind: "primary" | "secondary",
): { lines: EdgeMoneyRecapLine[]; totalDelta: number; shouldShow: boolean } {
  const cur = buildMoneyVisitSnapshot(lb, tasks, lbKind);
  if (!prev) {
    return { lines: [], totalDelta: 0, shouldShow: false };
  }
  if (prev.lbKind !== lbKind) {
    return { lines: [], totalDelta: 0, shouldShow: false };
  }

  const myNow = cur.myXp;
  const myWas = prev.myXp;
  const myDelta = Math.max(0, myNow - myWas);

  const lines: EdgeMoneyRecapLine[] = [];
  for (const t of tasks ?? []) {
    const p = prev.tasks[t.ruleId] ?? {};
    const c = cur.tasks[t.ruleId] ?? {};

    if (t.kind === "invite_friend" && t.invite) {
      const was = typeof p.invPts === "number" ? p.invPts : 0;
      const now = typeof c.invPts === "number" ? c.invPts : 0;
      const d = now - was;
      if (d > 0) lines.push({ label: "За приглашённых друзей", points: d });
    }

    if (t.kind === "follow_creator" && !p.followDone && c.followDone) {
      const pts = Math.max(0, Math.floor(Number(t.points) || 0));
      if (pts > 0) lines.push({ label: "Подписка на создателя", points: pts });
    }
  }

  const sumAttributed = lines.reduce((s, x) => s + x.points, 0);
  const residual = myDelta - sumAttributed;
  if (residual > 0) {
    lines.push({ label: "Сообщения, звонки и другие задания", points: residual });
  }

  const lineSum = lines.reduce((s, x) => s + x.points, 0);
  const totalDelta = Math.max(myDelta, lineSum);
  const shouldShow = lineSum > 0 || myDelta > 0;
  return { lines: lines.filter((l) => l.points > 0), totalDelta, shouldShow };
}

export function stringifyMoneyVisitSnapshot(s: EdgeMoneyVisitSnapshotV2): string {
  return JSON.stringify(s);
}
