import { eq } from "drizzle-orm";
import { ensurePlatformSettingsCompat, getDb } from "../../db";
import { platformSettings } from "@shared/schema";

const ROW_ID = "default";

export type PlatformPublicDto = {
  bannerEnabled: boolean;
  bannerText: string;
  bannerVariant: "info" | "warning" | "danger";
  maintenanceMode: boolean;
  strictApiShield: boolean;
  /** Регистрация со звонком New-Tel (если ключи на сервере заданы и это включено). */
  registrationPhoneCallVerificationEnabled: boolean;
};

function defaults(): PlatformPublicDto {
  return {
    bannerEnabled: false,
    bannerText: "",
    bannerVariant: "info",
    maintenanceMode: false,
    strictApiShield: false,
    registrationPhoneCallVerificationEnabled: true,
  };
}

function normVariant(v: string | null | undefined): PlatformPublicDto["bannerVariant"] {
  if (v === "warning" || v === "danger") return v;
  return "info";
}

export async function platformGetPublic(): Promise<PlatformPublicDto> {
  await ensurePlatformSettingsCompat();
  try {
    const db = getDb();
    const [row] = await db.select().from(platformSettings).where(eq(platformSettings.id, ROW_ID)).limit(1);
    if (!row) return defaults();
    return {
      bannerEnabled: row.bannerEnabled,
      bannerText: row.bannerText ?? "",
      bannerVariant: normVariant(row.bannerVariant),
      maintenanceMode: row.maintenanceMode,
      strictApiShield: Boolean(row.strictApiShield),
      registrationPhoneCallVerificationEnabled: row.registrationPhoneCallVerificationEnabled !== false,
    };
  } catch {
    return defaults();
  }
}

export async function platformUpdate(patch: Partial<PlatformPublicDto>): Promise<PlatformPublicDto> {
  await ensurePlatformSettingsCompat();
  const db = getDb();
  const cur = await platformGetPublic();
  const next: PlatformPublicDto = {
    bannerEnabled: patch.bannerEnabled ?? cur.bannerEnabled,
    bannerText:
      patch.bannerText === undefined
        ? cur.bannerText
        : typeof patch.bannerText === "string"
          ? patch.bannerText.slice(0, 2000)
          : cur.bannerText,
    bannerVariant: patch.bannerVariant ?? cur.bannerVariant,
    maintenanceMode: patch.maintenanceMode ?? cur.maintenanceMode,
    strictApiShield: patch.strictApiShield ?? cur.strictApiShield,
    registrationPhoneCallVerificationEnabled:
      patch.registrationPhoneCallVerificationEnabled ?? cur.registrationPhoneCallVerificationEnabled,
  };
  await db
    .insert(platformSettings)
    .values({
      id: ROW_ID,
      bannerEnabled: next.bannerEnabled,
      bannerText: next.bannerText,
      bannerVariant: next.bannerVariant,
      maintenanceMode: next.maintenanceMode,
      strictApiShield: next.strictApiShield,
      registrationPhoneCallVerificationEnabled: next.registrationPhoneCallVerificationEnabled,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [platformSettings.id],
      set: {
        bannerEnabled: next.bannerEnabled,
        bannerText: next.bannerText,
        bannerVariant: next.bannerVariant,
        maintenanceMode: next.maintenanceMode,
        strictApiShield: next.strictApiShield,
        registrationPhoneCallVerificationEnabled: next.registrationPhoneCallVerificationEnabled,
        updatedAt: new Date(),
      },
    });
  return next;
}
