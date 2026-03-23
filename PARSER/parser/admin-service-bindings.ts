import type { VkParserBindingRow } from "../../shared/schema/vk-parser.js";
import {
  deleteBinding,
  getBindingById,
  insertBinding,
  listBindings,
  updateBinding,
} from "../storage/repo.js";
import { encryptVkToken } from "./token-crypto.js";
import { throwFriendlyIfDuplicateUserWall } from "./pg-errors.js";

export type PublicVkBinding = Omit<VkParserBindingRow, "vkAccessTokenEnc"> & { tokenConfigured: boolean };

function toPublic(row: VkParserBindingRow): PublicVkBinding {
  const { vkAccessTokenEnc, ...rest } = row;
  return { ...rest, tokenConfigured: Boolean(vkAccessTokenEnc?.length) };
}

function assertVkOwnerId(raw: string): string {
  const s = raw.trim();
  if (!/^-?\d+$/.test(s)) {
    throw new Error("vkOwnerId: id стены ВК (группа — отрицательное число, напр. -123456789)");
  }
  return s;
}

function clampInterval(n: unknown, fallback: number): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(5, Math.min(1440, Math.floor(x)));
}

function clampPerRun(n: unknown, fallback: number): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(1, Math.min(50, Math.floor(x)));
}

export async function adminListBindings(): Promise<PublicVkBinding[]> {
  const rows = await listBindings();
  return rows.map(toPublic);
}

export async function adminCreateBinding(input: {
  platformUserId: string;
  vkAccessToken: string;
  vkOwnerId: string;
  displayName?: string | null;
  parseIntervalMinutes?: number;
  postsPerRun?: number;
  requireModeration?: boolean;
  visibility?: "public" | "followers";
  cityLine?: string | null;
  enabled?: boolean;
}): Promise<PublicVkBinding> {
  const token = input.vkAccessToken?.trim();
  if (!token) throw new Error("Нужен токен доступа ВК");
  const enc = encryptVkToken(token);
  const vkOwnerId = assertVkOwnerId(input.vkOwnerId);
  const vis = input.visibility === "followers" ? "followers" : "public";
  const row = await insertBinding({
    platformUserId: input.platformUserId.trim(),
    vkAccessTokenEnc: enc,
    vkOwnerId,
    displayName: input.displayName?.trim() || null,
    parseIntervalMinutes: clampInterval(input.parseIntervalMinutes, 30),
    postsPerRun: clampPerRun(input.postsPerRun, 5),
    requireModeration: input.requireModeration ?? true,
    visibility: vis,
    cityLine: input.cityLine?.trim() || null,
    enabled: input.enabled ?? true,
  });
  return toPublic(row);
}

export async function adminUpdateBinding(
  id: string,
  patch: Partial<{
    displayName: string | null;
    vkAccessToken: string;
    vkOwnerId: string;
    parseIntervalMinutes: number;
    postsPerRun: number;
    requireModeration: boolean;
    visibility: "public" | "followers";
    cityLine: string | null;
    enabled: boolean;
  }>,
): Promise<PublicVkBinding | undefined> {
  const existing = await getBindingById(id);
  if (!existing) return undefined;

  const next: Record<string, unknown> = {};
  if (patch.displayName !== undefined) next.displayName = patch.displayName?.trim() || null;
  if (patch.vkOwnerId !== undefined) next.vkOwnerId = assertVkOwnerId(patch.vkOwnerId);
  if (patch.parseIntervalMinutes !== undefined) {
    next.parseIntervalMinutes = clampInterval(patch.parseIntervalMinutes, 30);
  }
  if (patch.postsPerRun !== undefined) {
    next.postsPerRun = clampPerRun(patch.postsPerRun, 5);
  }
  if (patch.requireModeration !== undefined) next.requireModeration = patch.requireModeration;
  if (patch.visibility !== undefined) {
    next.visibility = patch.visibility === "followers" ? "followers" : "public";
  }
  if (patch.cityLine !== undefined) next.cityLine = patch.cityLine?.trim() || null;
  if (patch.enabled !== undefined) next.enabled = patch.enabled;
  if (patch.vkAccessToken !== undefined && patch.vkAccessToken.trim() !== "") {
    next.vkAccessTokenEnc = encryptVkToken(patch.vkAccessToken.trim());
  }

  try {
    const row = await updateBinding(id, next as Parameters<typeof updateBinding>[1]);
    return row ? toPublic(row) : undefined;
  } catch (e) {
    throwFriendlyIfDuplicateUserWall(e);
  }
}

export async function adminDeleteBinding(id: string): Promise<boolean> {
  const existing = await getBindingById(id);
  if (!existing) return false;
  await deleteBinding(id);
  return true;
}
