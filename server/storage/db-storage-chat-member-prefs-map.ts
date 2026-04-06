import type { ChatMemberPrefs } from "@shared/schema";

export type ChatMemberPrefsMapEntry = {
  pinnedAt: Date | null;
  hiddenAt: Date | null;
  listSection: string;
};

export function chatMemberPrefsRowsToMap(rows: ChatMemberPrefs[]): Map<string, ChatMemberPrefsMapEntry> {
  const m = new Map<string, ChatMemberPrefsMapEntry>();
  for (const r of rows) {
    m.set(r.chatId, {
      pinnedAt: r.pinnedAt ?? null,
      hiddenAt: r.hiddenAt ?? null,
      listSection: r.listSection ?? "general",
    });
  }
  return m;
}

/** Postgres: relation does not exist — таблица ещё не смигрирована. */
export function isPostgresUndefinedTableError(err: unknown): boolean {
  const code =
    err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
  return code === "42P01";
}
