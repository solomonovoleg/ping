import { eq } from "drizzle-orm";
import { platformSettings, referralAutoGrants } from "@shared/schema";
import { getDb } from "../db";

const ROW_ID = "default";

export type ReferralProgramSettings = {
  defaultInvites: number;
  repeatEnabled: boolean;
  repeatInvites: number;
  repeatAfterHours: number;
  multiUseDefaultExpiresHours: number;
};

export type ReferralAutoGrantState = {
  firstLimitReachedAt: Date | null;
  bonusGrantedAt: Date | null;
};

const SETTINGS_DEFAULTS: ReferralProgramSettings = {
  defaultInvites: 3,
  repeatEnabled: false,
  repeatInvites: 5,
  repeatAfterHours: 72,
  multiUseDefaultExpiresHours: 7 * 24,
};

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizePatch(
  patch: Partial<ReferralProgramSettings>,
): Partial<ReferralProgramSettings> {
  const out: Partial<ReferralProgramSettings> = {};
  if (patch.defaultInvites !== undefined) out.defaultInvites = clampInt(patch.defaultInvites, 3, 1, 200);
  if (patch.repeatEnabled !== undefined) out.repeatEnabled = patch.repeatEnabled === true;
  if (patch.repeatInvites !== undefined) out.repeatInvites = clampInt(patch.repeatInvites, 5, 1, 500);
  if (patch.repeatAfterHours !== undefined) out.repeatAfterHours = clampInt(patch.repeatAfterHours, 72, 1, 24 * 90);
  if (patch.multiUseDefaultExpiresHours !== undefined) {
    out.multiUseDefaultExpiresHours = clampInt(patch.multiUseDefaultExpiresHours, 7 * 24, 1, 24 * 90);
  }
  return out;
}

export async function getReferralProgramSettings(): Promise<ReferralProgramSettings> {
  try {
    const db = getDb();
    const [row] = await db.select().from(platformSettings).where(eq(platformSettings.id, ROW_ID)).limit(1);
    if (!row) return { ...SETTINGS_DEFAULTS };
    return {
      defaultInvites: clampInt(row.referralDefaultInvites, SETTINGS_DEFAULTS.defaultInvites, 1, 200),
      repeatEnabled: row.referralRepeatEnabled === true,
      repeatInvites: clampInt(row.referralRepeatInvites, SETTINGS_DEFAULTS.repeatInvites, 1, 500),
      repeatAfterHours: clampInt(row.referralRepeatAfterHours, SETTINGS_DEFAULTS.repeatAfterHours, 1, 24 * 90),
      multiUseDefaultExpiresHours: clampInt(
        row.referralMultiUseDefaultExpiresHours,
        SETTINGS_DEFAULTS.multiUseDefaultExpiresHours,
        1,
        24 * 90,
      ),
    };
  } catch {
    return { ...SETTINGS_DEFAULTS };
  }
}

export async function updateReferralProgramSettings(
  patch: Partial<ReferralProgramSettings>,
): Promise<ReferralProgramSettings> {
  const db = getDb();
  const cur = await getReferralProgramSettings();
  const safePatch = normalizePatch(patch);
  const next: ReferralProgramSettings = {
    defaultInvites: safePatch.defaultInvites ?? cur.defaultInvites,
    repeatEnabled: safePatch.repeatEnabled ?? cur.repeatEnabled,
    repeatInvites: safePatch.repeatInvites ?? cur.repeatInvites,
    repeatAfterHours: safePatch.repeatAfterHours ?? cur.repeatAfterHours,
    multiUseDefaultExpiresHours:
      safePatch.multiUseDefaultExpiresHours ?? cur.multiUseDefaultExpiresHours,
  };
  await db
    .insert(platformSettings)
    .values({
      id: ROW_ID,
      referralDefaultInvites: next.defaultInvites,
      referralRepeatEnabled: next.repeatEnabled,
      referralRepeatInvites: next.repeatInvites,
      referralRepeatAfterHours: next.repeatAfterHours,
      referralMultiUseDefaultExpiresHours: next.multiUseDefaultExpiresHours,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [platformSettings.id],
      set: {
        referralDefaultInvites: next.defaultInvites,
        referralRepeatEnabled: next.repeatEnabled,
        referralRepeatInvites: next.repeatInvites,
        referralRepeatAfterHours: next.repeatAfterHours,
        referralMultiUseDefaultExpiresHours: next.multiUseDefaultExpiresHours,
        updatedAt: new Date(),
      },
    });
  return next;
}

export async function getReferralAutoGrantState(userId: string): Promise<ReferralAutoGrantState> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(referralAutoGrants)
    .where(eq(referralAutoGrants.userId, userId))
    .limit(1);
  return {
    firstLimitReachedAt: row?.firstLimitReachedAt ?? null,
    bonusGrantedAt: row?.bonusGrantedAt ?? null,
  };
}

export async function setReferralFirstLimitReachedAt(
  userId: string,
  at: Date,
): Promise<void> {
  const db = getDb();
  const [current] = await db
    .select({
      userId: referralAutoGrants.userId,
      firstLimitReachedAt: referralAutoGrants.firstLimitReachedAt,
    })
    .from(referralAutoGrants)
    .where(eq(referralAutoGrants.userId, userId))
    .limit(1);
  if (!current) {
    await db.insert(referralAutoGrants).values({
      userId,
      firstLimitReachedAt: at,
      bonusGrantedAt: null,
      updatedAt: new Date(),
    });
    return;
  }
  if (current.firstLimitReachedAt != null) return;
  await db
    .update(referralAutoGrants)
    .set({ firstLimitReachedAt: at, updatedAt: new Date() })
    .where(eq(referralAutoGrants.userId, userId));
}

export async function markReferralBonusGranted(
  userId: string,
  at: Date,
): Promise<void> {
  const db = getDb();
  await db
    .insert(referralAutoGrants)
    .values({
      userId,
      firstLimitReachedAt: at,
      bonusGrantedAt: at,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [referralAutoGrants.userId],
      set: {
        bonusGrantedAt: at,
        updatedAt: new Date(),
      },
    });
}
