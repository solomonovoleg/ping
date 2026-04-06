import { and, eq, gt, isNull, or, sql, type SQL } from "drizzle-orm";
import { referralCodes } from "@shared/schema";

/** Код ещё можно использовать (срок, лимит, одноразовость / многоразовость). */
export function referralCodeUsableCondition(): SQL {
  return or(
    and(eq(referralCodes.maxUses, 1), isNull(referralCodes.usedAt)),
    eq(referralCodes.maxUses, -1),
    and(gt(referralCodes.maxUses, 1), sql`${referralCodes.useCount} < ${referralCodes.maxUses}`),
  ) as SQL;
}
