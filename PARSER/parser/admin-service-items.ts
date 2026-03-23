import type { PostMediaLayout } from "../../shared/post-media-layout.js";
import {
  VK_PARSER_ITEM_STATUSES,
  type VkParserItemStatus,
} from "../../shared/schema/vk-parser.js";
import {
  countItems,
  getBindingById,
  getItemById,
  listItems,
  updateItem,
} from "../storage/repo.js";
import { platformPublishPost } from "./platform-client.js";

function normalizeItemStatusFilter(raw: string | undefined): VkParserItemStatus | undefined {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return undefined;
  return (VK_PARSER_ITEM_STATUSES as readonly string[]).includes(s) ? (s as VkParserItemStatus) : undefined;
}

export async function adminListItems(query: {
  bindingId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: Awaited<ReturnType<typeof listItems>>; total: number }> {
  const limit = Math.min(100, Math.max(1, query.limit ?? 40));
  const offset = Math.max(0, query.offset ?? 0);
  const status = normalizeItemStatusFilter(query.status);
  const bindingId = query.bindingId?.trim() || undefined;
  const [items, total] = await Promise.all([
    listItems({ bindingId, status, limit, offset }),
    countItems({ bindingId, status }),
  ]);
  return { items, total };
}

export async function adminApproveItem(itemId: string): Promise<{ platformPostId: string }> {
  const item = await getItemById(itemId);
  if (!item) throw new Error("Запись не найдена");
  if (item.status !== "pending_review") throw new Error("Можно одобрить только ожидающие записи");
  const binding = await getBindingById(item.bindingId);
  if (!binding) throw new Error("Привязка удалена");

  const urls = (item.mediaUrls as string[] | null)?.filter(Boolean) ?? [];
  const mediaLayout = (item.mediaLayout as PostMediaLayout | null) ?? null;
  const vis = binding.visibility === "followers" ? "followers" : "public";

  const payload = await platformPublishPost({
    platformUserId: binding.platformUserId,
    text: item.postText?.trim() || (urls.length ? " " : ""),
    imageUrl: urls[0] ?? null,
    mediaUrls: urls.length ? urls : null,
    mediaLayout,
    visibility: vis,
  });

  await updateItem(itemId, {
    status: "published",
    platformPostId: payload.id,
    reviewedAt: new Date(),
    errorMessage: null,
  });
  return { platformPostId: payload.id };
}

export async function adminRejectItem(itemId: string): Promise<void> {
  const item = await getItemById(itemId);
  if (!item) throw new Error("Запись не найдена");
  if (item.status !== "pending_review") throw new Error("Можно отклонить только ожидающие записи");
  await updateItem(itemId, { status: "rejected", reviewedAt: new Date() });
}
