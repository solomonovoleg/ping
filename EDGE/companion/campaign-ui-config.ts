/**
 * UI-компаньона из `edge_campaigns.config_json.companion` (порядок экранов, статья, итоги).
 * Без миграций — только JSON.
 */

export type CompanionSurfaceId =
  | "tasks"
  | "character"
  | "info"
  | "leaderboard"
  | "leaderboardSecondary"
  | "results"
  | "prizes";

const ALL_SURFACES: CompanionSurfaceId[] = [
  "tasks",
  "character",
  "info",
  "leaderboard",
  "leaderboardSecondary",
  "results",
  "prizes",
];

export type CompanionInfoBlock =
  | { type: "paragraph"; text: string }
  | { type: "image"; url: string; alt?: string }
  | { type: "video"; url: string };

export type CompanionInfoArticle = {
  title?: string;
  blocks: CompanionInfoBlock[];
};

export type CompanionResultsConfig = {
  lastDrawSummary?: string;
  nextDrawHint?: string;
  winners?: { title?: string; name: string }[];
};

/** Картинка персонажа (PNG) и подпись для людей — из `config_json.companion.character`. */
export type CompanionCharacterConfig = {
  assetUrl: string;
  displayName: string;
};

export type CompanionUiPayload = {
  surfaceOrder: CompanionSurfaceId[];
  /**
   * Если задан непустой массив — в игре видны только эти экраны (в этом порядке).
   * Иначе действует прежняя логика: `surfaceOrder` переупорядочивает, недостающие id дописываются.
   */
  onlySurfaces: CompanionSurfaceId[] | null;
  infoArticle: CompanionInfoArticle | null;
  results: CompanionResultsConfig | null;
  character: CompanionCharacterConfig | null;
};

function isSurfaceId(s: string): s is CompanionSurfaceId {
  return (ALL_SURFACES as string[]).includes(s);
}

/** Задания — сразу слева от персонажа (свайп с экрана персонажа). */
function normalizeTasksBeforeCharacter(order: CompanionSurfaceId[]): CompanionSurfaceId[] {
  if (!order.includes("character")) return order;
  const rest: CompanionSurfaceId[] = order.filter((id) => id !== "tasks");
  const ci = rest.indexOf("character");
  if (ci < 0) return order;
  const out: CompanionSurfaceId[] = [...rest];
  out.splice(ci, 0, "tasks");
  return out;
}

function parseBlocks(raw: unknown): CompanionInfoBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: CompanionInfoBlock[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object" || Array.isArray(x)) continue;
    const o = x as Record<string, unknown>;
    const t = o.type;
    if (t === "paragraph" && typeof o.text === "string") {
      out.push({ type: "paragraph", text: o.text });
    } else if (t === "image" && typeof o.url === "string") {
      out.push({ type: "image", url: o.url, alt: typeof o.alt === "string" ? o.alt : undefined });
    } else if (t === "video" && typeof o.url === "string") {
      out.push({ type: "video", url: o.url });
    }
  }
  return out;
}

function parseResults(raw: unknown): CompanionResultsConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const winnersRaw = o.winners;
  const winners: { title?: string; name: string }[] = [];
  if (Array.isArray(winnersRaw)) {
    for (const w of winnersRaw) {
      if (!w || typeof w !== "object") continue;
      const ww = w as Record<string, unknown>;
      if (typeof ww.name === "string" && ww.name.trim()) {
        winners.push({
          name: ww.name.trim(),
          title: typeof ww.title === "string" ? ww.title : undefined,
        });
      }
    }
  }
  const last =
    typeof o.lastDrawSummary === "string" ? o.lastDrawSummary.trim() : "";
  const next = typeof o.nextDrawHint === "string" ? o.nextDrawHint.trim() : "";
  if (!last && !next && winners.length === 0) return null;
  return {
    lastDrawSummary: last || undefined,
    nextDrawHint: next || undefined,
    winners: winners.length ? winners : undefined,
  };
}

export function mapCompanionUiFromConfig(configJson: unknown): CompanionUiPayload {
  const root =
    configJson && typeof configJson === "object" && !Array.isArray(configJson)
      ? (configJson as Record<string, unknown>)
      : {};
  const comp = root.companion;
  const c = comp && typeof comp === "object" && !Array.isArray(comp) ? (comp as Record<string, unknown>) : {};

  const onlyRaw = c.onlySurfaces;
  let onlyParsed: CompanionSurfaceId[] | null = null;
  if (Array.isArray(onlyRaw) && onlyRaw.length > 0) {
    const next: CompanionSurfaceId[] = [];
    for (const x of onlyRaw) {
      if (typeof x === "string" && isSurfaceId(x) && !next.includes(x)) next.push(x);
    }
    onlyParsed = next.length ? next : null;
  }

  let surfaceOrder: CompanionSurfaceId[];
  if (onlyParsed) {
    surfaceOrder = normalizeTasksBeforeCharacter(onlyParsed);
  } else {
    surfaceOrder = [...ALL_SURFACES];
    const orderRaw = c.surfaceOrder;
    if (Array.isArray(orderRaw)) {
      const next: CompanionSurfaceId[] = [];
      for (const x of orderRaw) {
        if (typeof x === "string" && isSurfaceId(x) && !next.includes(x)) next.push(x);
      }
      for (const id of ALL_SURFACES) {
        if (!next.includes(id)) next.push(id);
      }
      surfaceOrder = next;
    }
    surfaceOrder = normalizeTasksBeforeCharacter(surfaceOrder);
  }

  const art = c.infoArticle;
  let infoArticle: CompanionInfoArticle | null = null;
  if (art && typeof art === "object" && !Array.isArray(art)) {
    const a = art as Record<string, unknown>;
    const blocks = parseBlocks(a.blocks);
    const title = typeof a.title === "string" ? a.title.trim() : "";
    if (blocks.length || title) {
      infoArticle = { blocks, ...(title ? { title } : {}) };
    }
  }

  const results = parseResults(c.results);

  let character: CompanionCharacterConfig | null = null;
  const ch = c.character;
  if (ch && typeof ch === "object" && !Array.isArray(ch)) {
    const o = ch as Record<string, unknown>;
    const assetUrl = typeof o.assetUrl === "string" ? o.assetUrl.trim() : "";
    const displayName = typeof o.displayName === "string" ? o.displayName.trim() : "";
    if (assetUrl || displayName) {
      character = { assetUrl, displayName };
    }
  }

  return {
    surfaceOrder,
    onlySurfaces: onlyParsed,
    infoArticle,
    results,
    character,
  };
}
