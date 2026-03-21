import { API, apiFetch } from "@/lib/api-base";

export type AiSearchTagHit = {
  tag_label: string;
  tag_key: string;
  chat_id: string;
  hit_count: number;
  last_at: string;
  snippet: string | null;
};

export type AiSearchInterestHit = {
  kind: string;
  label_display: string;
  label_key: string;
  score: number;
  evidence_count: number;
  last_at: string;
};

export type AiSearchHotSignal = {
  key: string;
  label: string;
  snippet: string | null;
  chat_id: string | null;
  score: number;
  last_at?: string;
  expires_at: string;
};

export async function fetchAiSearchHot(limit = 16): Promise<{ hot: AiSearchHotSignal[] }> {
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await apiFetch(`${API}/ai-search/hot?${params}`, { credentials: "include" });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as { message?: string }).message || "Ошибка горячих тем");
  }
  return res.json();
}

export async function fetchAiSearchAdContext(opts?: {
  limitHot?: number;
  limitCommercial?: number;
  limitBehavioral?: number;
}): Promise<{
  hot: AiSearchHotSignal[];
  commercial: AiSearchInterestHit[];
  behavioral: AiSearchInterestHit[];
}> {
  const p = new URLSearchParams();
  if (opts?.limitHot != null) p.set("limitHot", String(opts.limitHot));
  if (opts?.limitCommercial != null) p.set("limitCommercial", String(opts.limitCommercial));
  if (opts?.limitBehavioral != null) p.set("limitBehavioral", String(opts.limitBehavioral));
  const qs = p.toString();
  const res = await apiFetch(`${API}/ai-search/ad-context${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as { message?: string }).message || "Ошибка контекста");
  }
  return res.json();
}

export async function searchAiMemory(q: string): Promise<{
  query: string;
  tags: AiSearchTagHit[];
  interests: AiSearchInterestHit[];
  hint?: string;
}> {
  const params = new URLSearchParams({ q: q.trim() });
  const res = await apiFetch(`${API}/ai-search?${params}`, { credentials: "include" });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as { message?: string }).message || "Ошибка поиска");
  }
  return res.json();
}
