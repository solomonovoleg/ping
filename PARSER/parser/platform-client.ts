import type { PostMediaLayout } from "../../shared/post-media-layout.js";
import { getPlatformBaseUrl, getServiceSecret, isNodeProduction } from "../config/env.js";

export type PlatformPublishBody = {
  platformUserId: string;
  text: string;
  imageUrl: string | null;
  mediaUrls: string[] | null;
  mediaLayout: PostMediaLayout | null;
  visibility: "public" | "followers";
};

function authHeaders(): Record<string, string> {
  const s = getServiceSecret();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (s) h.Authorization = `Bearer ${s}`;
  return h;
}

/** Создание поста на платформе (loopback + общий секрет). */
export async function platformPublishPost(body: PlatformPublishBody): Promise<{ id: string }> {
  if (isNodeProduction() && !getServiceSecret()) {
    throw new Error("PARSER_SERVICE_SECRET обязателен в production для публикации постов");
  }
  const base = getPlatformBaseUrl();
  const url = `${base}/internal/parser/publish`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j.message) msg = j.message;
    } catch {
      /* keep text */
    }
    throw new Error(msg || `Платформа: HTTP ${res.status}`);
  }
  const json = JSON.parse(text) as { id?: string };
  if (!json.id) throw new Error("Платформа: нет id поста");
  return { id: json.id };
}
