import { ilike, or, sql, type SQL } from "drizzle-orm";
import { users } from "@shared/schema";
import { userSearchConditionsFromPhones } from "./db-storage-user-phone-search";

/** OR по полям пользователя для админского списка (без экранирования `%` в общем like — как раньше). */
export function buildAdminListUsersSearchOrClause(search: string): SQL | undefined {
  const trimmed = search.trim();
  if (!trimmed) return undefined;
  const like = `%${trimmed}%`;
  const clauses: SQL[] = [
    ilike(users.displayName, like),
    ilike(users.surname, like),
    ilike(users.nickname, like),
  ];
  if (/^\d+$/u.test(trimmed)) {
    const digitPattern = `%${trimmed}%`;
    clauses.push(sql`CAST(${users.publicId} AS TEXT) LIKE ${digitPattern}`);
  }
  clauses.push(...userSearchConditionsFromPhones(search));
  return or(...clauses);
}
