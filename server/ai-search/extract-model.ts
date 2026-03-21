import { callOpenRouter, isOpenRouterConfigured } from "../lib/openrouter";

export type Extracted = {
  tags: Array<{ key: string; label: string; who?: string; snippet?: string }>;
  /** Долгий горизонт: покупки, бренды, услуги (профиль). */
  commercial: Array<{ key: string; label: string; score?: number }>;
  /** Долгий горизонт: хобби, работа, привычки. */
  behavioral: Array<{ key: string; label: string; score?: number }>;
  /**
   * Короткий горизонт: явное намерение «сейчас / в ближайшее время» (выбор товара, заказ, сравнение моделей).
   * Отдельно от commercial — для быстрого таргетинга и кеша.
   */
  hot_now: Array<{ key: string; label: string; score?: number; snippet?: string }>;
};

const EMPTY_EXTRACTED: Extracted = {
  tags: [],
  commercial: [],
  behavioral: [],
  hot_now: [],
};

function stripJsonFence(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  return t.trim();
}

export function parseExtractJson(raw: string): Extracted {
  try {
    const t = stripJsonFence(raw);
    const o = JSON.parse(t) as Record<string, unknown>;
    const tags = Array.isArray(o.tags) ? o.tags : [];
    const commercial = Array.isArray(o.commercial) ? o.commercial : [];
    const behavioral = Array.isArray(o.behavioral) ? o.behavioral : [];
    const hot_now = Array.isArray(o.hot_now) ? o.hot_now : [];
    return {
      tags: tags
        .map((x) => x as Record<string, unknown>)
        .filter((x) => typeof x.key === "string" && typeof x.label === "string")
        .map((x) => ({
          key: String(x.key),
          label: String(x.label),
          who: typeof x.who === "string" ? x.who : undefined,
          snippet: typeof x.snippet === "string" ? x.snippet : undefined,
        }))
        .slice(0, 8),
      commercial: commercial
        .map((x) => x as Record<string, unknown>)
        .filter((x) => typeof x.key === "string" && typeof x.label === "string")
        .map((x) => ({
          key: String(x.key),
          label: String(x.label),
          score: typeof x.score === "number" ? x.score : 50,
        }))
        .slice(0, 5),
      behavioral: behavioral
        .map((x) => x as Record<string, unknown>)
        .filter((x) => typeof x.key === "string" && typeof x.label === "string")
        .map((x) => ({
          key: String(x.key),
          label: String(x.label),
          score: typeof x.score === "number" ? x.score : 50,
        }))
        .slice(0, 5),
      hot_now: hot_now
        .map((x) => x as Record<string, unknown>)
        .filter((x) => typeof x.key === "string" && typeof x.label === "string")
        .map((x) => ({
          key: String(x.key),
          label: String(x.label),
          score: typeof x.score === "number" ? x.score : 70,
          snippet: typeof x.snippet === "string" ? x.snippet : undefined,
        }))
        .slice(0, 4),
    };
  } catch {
    return EMPTY_EXTRACTED;
  }
}

export async function extractFromDialogueChunk(transcript: string): Promise<Extracted> {
  if (!isOpenRouterConfigured()) return EMPTY_EXTRACTED;
  if (!transcript.trim()) return EMPTY_EXTRACTED;
  const system =
    "Извлеки из фрагмента чата JSON без markdown. " +
    "tags: темы (до 8). commercial: долгосрочные покупки/бренды/услуги (до 5). " +
    "behavioral: хобби/работа/привычки (до 5). " +
    "hot_now: только явное намерение купить/выбрать сейчас или в ближайшие дни — конкретный товар или услуга (до 4, snippet при наличии). " +
    "Если срочного намерения нет — hot_now:[]. " +
    'Формат: {"tags":[{"key":"slug","label":"ru","who":"me|other|group","snippet":"..."}],' +
    '"commercial":[{"key":"slug","label":"ru","score":1-100}],' +
    '"behavioral":[{"key":"slug","label":"ru","score":1-100}],' +
    '"hot_now":[{"key":"slug","label":"ru","score":1-100,"snippet":"..."}]}. ' +
    "key: латиница, lower-case.";

  try {
    const raw = await callOpenRouter(
      [
        { role: "system", content: system },
        { role: "user", content: `Диалог:\n${transcript.slice(0, 9_000)}` },
      ],
      { maxTokens: 720, temperature: 0.12 },
    );
    return parseExtractJson(raw);
  } catch {
    return EMPTY_EXTRACTED;
  }
}
