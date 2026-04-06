type TablePasteFallbackEvent = "fallback_shown" | "retry_clicked" | "reopen_success";

const TABLE_PASTE_EVENTS: ReadonlySet<string> = new Set<TablePasteFallbackEvent>([
  "fallback_shown",
  "retry_clicked",
  "reopen_success",
]);

const RECENT_CAP = 80;
const CHAT_ID_PREVIEW_LEN = 64;

type TablePasteRecentEvent = {
  at: string;
  event: TablePasteFallbackEvent;
  chatId: string;
  cols: number;
  rows: number;
  viaRetry: boolean;
  userId: string;
};

const tablePasteEventCounts: Record<TablePasteFallbackEvent, number> = {
  fallback_shown: 0,
  retry_clicked: 0,
  reopen_success: 0,
};

const tablePasteUniqueUsers = new Set<string>();
const tablePasteRecent: TablePasteRecentEvent[] = [];

function toFiniteInt(input: unknown): number | null {
  if (typeof input !== "number" || !Number.isFinite(input)) return null;
  return Math.max(0, Math.floor(input));
}

function safeChatId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.length > CHAT_ID_PREVIEW_LEN ? trimmed.slice(0, CHAT_ID_PREVIEW_LEN) : trimmed;
}

export function recordTablePasteFallbackClientEvent(args: {
  event: string;
  chatId: unknown;
  cols: unknown;
  rows: unknown;
  viaRetry: unknown;
  userId: string;
}): boolean {
  if (!TABLE_PASTE_EVENTS.has(args.event)) return false;
  const chatId = safeChatId(args.chatId);
  if (!chatId) return false;
  const cols = toFiniteInt(args.cols);
  const rows = toFiniteInt(args.rows);
  if (cols == null || rows == null || cols <= 0 || rows <= 0) return false;

  const event = args.event as TablePasteFallbackEvent;
  tablePasteEventCounts[event] += 1;
  tablePasteUniqueUsers.add(args.userId);

  tablePasteRecent.unshift({
    at: new Date().toISOString(),
    event,
    chatId,
    cols,
    rows,
    viaRetry: Boolean(args.viaRetry),
    userId: args.userId,
  });
  while (tablePasteRecent.length > RECENT_CAP) tablePasteRecent.pop();
  return true;
}

const ISEE_TTFP_RECENT_CAP = 60;
const ISEE_POST_ID_MAX = 64;
const ISEE_MS_MAX = 120_000;

type IseeTtfpRecent = {
  at: string;
  userId: string;
  ms: number;
  postId: string;
  connectionType: string | null;
};

const iseeTtfpRecent: IseeTtfpRecent[] = [];
let iseeTtfpCount = 0;
const iseeTtfpUniqueUsers = new Set<string>();

function safeIseePostId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.length > ISEE_POST_ID_MAX ? trimmed.slice(0, ISEE_POST_ID_MAX) : trimmed;
}

export function recordIseeTimeToFirstPlayClientEvent(args: {
  userId: string;
  ms: unknown;
  postId: unknown;
  connectionType: unknown;
}): boolean {
  const postId = safeIseePostId(args.postId);
  if (!postId) return false;
  const msRaw = typeof args.ms === "number" && Number.isFinite(args.ms) ? Math.round(args.ms) : null;
  if (msRaw == null || msRaw < 0 || msRaw > ISEE_MS_MAX) return false;

  let connectionType: string | null = null;
  if (typeof args.connectionType === "string") {
    const c = args.connectionType.trim().slice(0, 32);
    connectionType = c || null;
  }

  iseeTtfpCount += 1;
  iseeTtfpUniqueUsers.add(args.userId);
  iseeTtfpRecent.unshift({
    at: new Date().toISOString(),
    userId: args.userId,
    ms: msRaw,
    postId,
    connectionType,
  });
  while (iseeTtfpRecent.length > ISEE_TTFP_RECENT_CAP) iseeTtfpRecent.pop();
  return true;
}

export function getClientTelemetrySnapshot() {
  return {
    tablePasteFallback: {
      counts: { ...tablePasteEventCounts },
      uniqueUsers: tablePasteUniqueUsers.size,
      recent: [...tablePasteRecent],
    },
    iseeTimeToFirstPlay: {
      count: iseeTtfpCount,
      uniqueUsers: iseeTtfpUniqueUsers.size,
      recent: [...iseeTtfpRecent],
    },
  };
}
