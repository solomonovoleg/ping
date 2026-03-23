import { vkApiGet } from "./vk-api.js";

type VkPhotoPayload = { sizes?: { url?: string; width?: number; height?: number }[] };

export type VkWallAttachment =
  | { type: "photo"; photo: VkPhotoPayload }
  | { type: string };

export type VkWallPost = {
  id: number;
  owner_id: number;
  date?: number;
  text?: string;
  attachments?: VkWallAttachment[];
};

function pickLargestPhotoUrl(sizes: { url?: string; width?: number; height?: number }[] | undefined): string | null {
  if (!sizes?.length) return null;
  let best: { url: string; area: number } | null = null;
  for (const s of sizes) {
    const url = s.url;
    if (!url) continue;
    const w = s.width ?? 0;
    const h = s.height ?? 0;
    const area = w * h;
    if (!best || area > best.area) best = { url, area };
  }
  return best?.url ?? null;
}

export function extractPhotoUrlsFromPost(post: VkWallPost): string[] {
  const urls: string[] = [];
  const atts = post.attachments ?? [];
  for (const a of atts) {
    if (a.type !== "photo") continue;
    const photo = (a as { type: "photo"; photo: VkPhotoPayload }).photo;
    const url = pickLargestPhotoUrl(photo?.sizes);
    if (url) urls.push(url);
  }
  return urls.slice(0, 10);
}

export function vkPostKey(post: VkWallPost): string {
  return `${post.owner_id}_${post.id}`;
}

export async function vkWallGet(accessToken: string, ownerId: string, count: number): Promise<VkWallPost[]> {
  const params = new URLSearchParams({
    access_token: accessToken,
    owner_id: ownerId.trim(),
    count: String(Math.min(100, Math.max(1, Math.floor(count)))),
    filter: "owner",
  });
  const data = await vkApiGet<{ items?: VkWallPost[] }>("wall.get", params);
  return data?.items ?? [];
}

export async function vkUsersGet(accessToken: string): Promise<{ id: number }> {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "",
  });
  const rows = await vkApiGet<{ id: number }[]>("users.get", params);
  const u = rows?.[0];
  if (!u) throw new Error("VK users.get: пустой ответ");
  return u;
}
