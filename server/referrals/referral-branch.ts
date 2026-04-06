export type ReferralEdge = {
  userId: string;
  invitedById: string | null;
};

export type ReferralDepthStats = {
  depth: number;
  count: number;
};

export type ReferralBranchResult = {
  totalCount: number;
  byDepth: ReferralDepthStats[];
};

function normalizeMaxDepth(maxDepth: number): number {
  if (!Number.isFinite(maxDepth)) return 1;
  return Math.min(10, Math.max(1, Math.floor(maxDepth)));
}

function buildChildrenMap(edges: ReferralEdge[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const e of edges) {
    const parent = e.invitedById?.trim();
    const child = e.userId?.trim();
    if (!parent || !child || parent === child) continue;
    const list = m.get(parent) ?? [];
    list.push(child);
    m.set(parent, list);
  }
  return m;
}

/**
 * Считает ветку приглашений для пользователя (BFS), с ограничением глубины.
 * Циклы/дубли безопасно отсекаются через visited.
 */
export function computeReferralBranchFromEdges(
  rootUserId: string,
  edges: ReferralEdge[],
  maxDepth: number,
): ReferralBranchResult {
  const root = rootUserId.trim();
  if (!root) return { totalCount: 0, byDepth: [] };
  const depthLimit = normalizeMaxDepth(maxDepth);
  const children = buildChildrenMap(edges);

  const visited = new Set<string>([root]);
  const current = new Set<string>([root]);
  const out: ReferralDepthStats[] = [];

  for (let depth = 1; depth <= depthLimit; depth++) {
    const next = new Set<string>();
    for (const parent of current) {
      const kids = children.get(parent) ?? [];
      for (const kid of kids) {
        if (visited.has(kid)) continue;
        visited.add(kid);
        next.add(kid);
      }
    }
    out.push({ depth, count: next.size });
    if (next.size === 0) break;
    current.clear();
    for (const id of next) current.add(id);
  }

  return {
    totalCount: out.reduce((sum, x) => sum + x.count, 0),
    byDepth: out,
  };
}

/**
 * Утилита баллов по глубинам:
 * weightsByDepth[0] = вес 1-го колена, [1] = 2-го и т.д.
 */
export function computeWeightedReferralScore(
  branch: ReferralBranchResult,
  weightsByDepth: number[],
): number {
  if (!Array.isArray(weightsByDepth) || weightsByDepth.length === 0) return 0;
  let score = 0;
  for (const row of branch.byDepth) {
    const w = weightsByDepth[row.depth - 1] ?? 0;
    if (!Number.isFinite(w) || w <= 0) continue;
    score += row.count * Math.floor(w);
  }
  return score;
}

/**
 * Runtime-утилита для подсчёта ветки через произвольный источник детей.
 * Пример источника: storage.listInvitedUsers(userId).
 */
export async function computeReferralBranchWithFetcher(
  rootUserId: string,
  maxDepth: number,
  fetchChildrenIds: (userId: string) => Promise<string[]>,
): Promise<ReferralBranchResult> {
  const root = rootUserId.trim();
  if (!root) return { totalCount: 0, byDepth: [] };
  const depthLimit = normalizeMaxDepth(maxDepth);

  const visited = new Set<string>([root]);
  let current = [root];
  const byDepth: ReferralDepthStats[] = [];

  for (let depth = 1; depth <= depthLimit; depth++) {
    const nextSet = new Set<string>();
    for (const parent of current) {
      const ids = await fetchChildrenIds(parent);
      for (const raw of ids) {
        const id = String(raw ?? "").trim();
        if (!id || visited.has(id)) continue;
        visited.add(id);
        nextSet.add(id);
      }
    }
    byDepth.push({ depth, count: nextSet.size });
    if (nextSet.size === 0) break;
    current = Array.from(nextSet);
  }

  return {
    totalCount: byDepth.reduce((sum, x) => sum + x.count, 0),
    byDepth,
  };
}
