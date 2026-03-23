import { buildPostMediaLayout } from "../../shared/post-media-layout.js";
import type { VkParserBindingRow } from "../../shared/schema/vk-parser.js";
import { itemExistsForVkKey, insertItem } from "../storage/repo.js";
import { importRemoteImageToPostStorage } from "./media-import.js";
import { decryptVkToken } from "./token-crypto.js";
import { extractPhotoUrlsFromPost, vkPostKey, vkWallGet, type VkWallPost } from "./vk-wall.js";
import { platformPublishPost } from "./platform-client.js";

function composePostText(binding: VkParserBindingRow, raw: string): string {
  const base = raw.trim();
  const city = binding.cityLine?.trim();
  if (!city) return base || "";
  const tag = `📍 ${city}`;
  if (!base) return tag;
  return `${base}\n\n${tag}`;
}

async function processOnePost(binding: VkParserBindingRow, p: VkWallPost): Promise<"created" | "skipped" | "dup"> {
  const key = vkPostKey(p);
  if (await itemExistsForVkKey(binding.id, key)) return "dup";

  const rawText = (p.text ?? "").trim();
  const photoUrls = extractPhotoUrlsFromPost(p);
  if (!rawText && photoUrls.length === 0) {
    await insertItem({
      bindingId: binding.id,
      vkPostKey: key,
      status: "skipped",
      postText: "",
      mediaUrls: null,
      mediaLayout: null,
      vkPostDate: p.date ?? null,
      rawExcerpt: { reason: "empty" },
    });
    return "skipped";
  }

  let mediaUrls: string[] = [];
  let mediaLayout = null;
  try {
    for (const url of photoUrls) {
      mediaUrls.push(await importRemoteImageToPostStorage(url));
    }
    if (mediaUrls.length > 0) {
      mediaLayout = buildPostMediaLayout(mediaUrls.map(() => 1));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка импорта фото";
    await insertItem({
      bindingId: binding.id,
      vkPostKey: key,
      status: "failed",
      postText: composePostText(binding, rawText),
      mediaUrls: null,
      mediaLayout: null,
      vkPostDate: p.date ?? null,
      errorMessage: msg,
    });
    return "skipped";
  }

  const postText = composePostText(binding, rawText);
  const vis = binding.visibility === "followers" ? "followers" : "public";

  if (binding.requireModeration) {
    await insertItem({
      bindingId: binding.id,
      vkPostKey: key,
      status: "pending_review",
      postText: postText || (mediaUrls.length ? " " : ""),
      mediaUrls: mediaUrls.length ? mediaUrls : null,
      mediaLayout,
      vkPostDate: p.date ?? null,
      rawExcerpt: { vk: { id: p.id, owner_id: p.owner_id } },
    });
    return "created";
  }

  const payload = await platformPublishPost({
    platformUserId: binding.platformUserId,
    text: postText || (mediaUrls.length ? " " : ""),
    imageUrl: mediaUrls[0] ?? null,
    mediaUrls: mediaUrls.length ? mediaUrls : null,
    mediaLayout,
    visibility: vis,
  });

  await insertItem({
    bindingId: binding.id,
    vkPostKey: key,
    status: "published",
    postText: postText || " ",
    mediaUrls: mediaUrls.length ? mediaUrls : null,
    mediaLayout,
    platformPostId: payload.id,
    vkPostDate: p.date ?? null,
    reviewedAt: new Date(),
  });
  return "created";
}

export async function runBindingIngest(binding: VkParserBindingRow): Promise<{
  created: number;
  skipped: number;
  duplicates: number;
}> {
  const token = decryptVkToken(binding.vkAccessTokenEnc);
  const wall = await vkWallGet(token, binding.vkOwnerId, Math.max(binding.postsPerRun * 3, 10));

  let created = 0;
  let skipped = 0;
  let duplicates = 0;

  for (const p of wall) {
    if (created >= binding.postsPerRun) break;
    const r = await processOnePost(binding, p);
    if (r === "created") created++;
    else if (r === "dup") duplicates++;
    else skipped++;
  }

  return { created, skipped, duplicates };
}
