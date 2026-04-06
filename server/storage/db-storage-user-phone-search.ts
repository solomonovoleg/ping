import { eq, type SQL } from "drizzle-orm";
import { users } from "@shared/schema";
import { normalizedPhonesFromSearchQuery } from "../auth/phone";
import { isPhoneAtRestEnabled, phoneLookupHash } from "../auth/phone-at-rest";

/** Условия по `phone` / `phone_lookup_hash` для текстового поиска пользователей. */
export function userSearchConditionsFromPhones(query: string): SQL[] {
  const clauses: SQL[] = [];
  for (const np of normalizedPhonesFromSearchQuery(query)) {
    clauses.push(eq(users.phone, np));
    if (isPhoneAtRestEnabled()) {
      try {
        clauses.push(eq(users.phoneLookupHash, phoneLookupHash(np)));
      } catch {
        /* секрет не задан между проверкой и запросом */
      }
    }
  }
  return clauses;
}
