import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { platformSettings } from "@shared/schema";

const ROW_ID = "default";

export type PlatformPublicDto = {
  bannerEnabled: boolean;
  bannerText: string;
  bannerVariant: "info" | "warning" | "danger";
  maintenanceMode: boolean;
  strictApiShield: boolean;
};

function defaults(): PlatformPublicDto {
  return {
    bannerEnabled: false,
    bannerText: "",
    bannerVariant: "info",
    maintenanceMode: false,
    strictApiShield: false,
  };
}

function normVariant(v: string | null | undefined): PlatformPublicDto["bannerVariant"] {
  if (v === "warning" || v === "danger") return v;
  return "info";
}

export async function platformGetPublic(): Promise<PlatformPublicDto> {
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
    };
  } catch {
    return defaults();
  }
}

export async function platformUpdate(patch: Partial<PlatformPublicDto>): Promise<PlatformPublicDto> {
  const db = getDb();
  const cur = await platformGetPublic();
  const next: PlatformPublicDto = {
    bannerEnabled: patch.bannerEnabled ?? cur.bannerEnabled,
    bannerText: patch.bannerText !== undefined ? patch.bannerText.slice(0, 2000) : cur.bannerText,
    bannerVariant: patch.bannerVariant ?? cur.bannerVariant,
    maintenanceMode: patch.maintenanceMode ?? cur.maintenanceMode,
    strictApiShield: patch.strictApiShield ?? cur.strictApiShield,
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
        updatedAt: new Date(),
      },
    });
  return next;
}
