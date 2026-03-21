import { API, apiFetch } from "@/lib/api-base";

export async function fetchCitySuggestions(q: string, signal?: AbortSignal): Promise<string[]> {
  const t = q.trim();
  if (t.length < 2) return [];
  const res = await apiFetch(`${API}/geo/city-suggest?q=${encodeURIComponent(t)}`, {
    credentials: "include",
    cache: "no-store",
    signal,
  });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => ({}))) as { suggestions?: unknown };
  const list = Array.isArray(data.suggestions) ? data.suggestions : [];
  return list.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}
