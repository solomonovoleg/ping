import { API, apiFetch } from "@/lib/api-base";

export type HelpPageListItem = { slug: string; title: string; sortOrder: number };

export type HelpPagePayload = {
  slug: string;
  title: string;
  body: string;
  updatedAt: string;
};

export async function fetchHelpPagesList(): Promise<HelpPageListItem[]> {
  const res = await apiFetch(`${API}/help/pages`, { cache: "no-store" });
  if (!res.ok) throw new Error("Не удалось загрузить список справок");
  const data = (await res.json()) as { pages?: HelpPageListItem[] };
  return Array.isArray(data.pages) ? data.pages : [];
}

export async function fetchHelpPage(slug: string): Promise<HelpPagePayload> {
  const res = await apiFetch(`${API}/help/pages/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (res.status === 404) throw new Error("Страница не найдена");
  if (!res.ok) throw new Error("Не удалось загрузить страницу");
  return res.json();
}
