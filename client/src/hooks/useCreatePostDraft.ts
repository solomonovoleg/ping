import { useEffect, useRef } from "react";

const DRAFT_KEY = "ping_create_post_draft";

type MediaKind = "image" | "video" | "audio";
type MediaSlot = { type: "done"; url: string; kind: MediaKind } | { type: "uploading"; preview: string; id: number; kind: MediaKind };

function inferKindFromUrl(url: string): MediaKind {
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return "video";
  if (/\.(mp3|m4a|aac|wav|ogg)(\?|$)/i.test(url)) return "audio";
  return "image";
}

/** Из localStorage: только непустые уникальные строки, максимум maxMedia. */
function normalizeDraftMediaUrls(raw: unknown, maxMedia: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const u = x.trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= maxMedia) break;
  }
  return out;
}

export function useCreatePostDraft(
  maxChars: number,
  maxMedia: number,
  text: string,
  setText: (v: string) => void,
  mediaItems: MediaSlot[],
  setMediaItems: (v: MediaSlot[] | ((prev: MediaSlot[]) => MediaSlot[])) => void,
  toast: (opts: { title: string }) => void
) {
  const snapshotRef = useRef({ text: "", mediaUrls: [] as string[] });
  const validDoneUrls: string[] = [];
  {
    const seen = new Set<string>();
    for (const s of mediaItems) {
      if (s.type !== "done") continue;
      const u = s.url.trim();
      if (!u || seen.has(u)) continue;
      seen.add(u);
      validDoneUrls.push(u);
    }
  }
  snapshotRef.current = { text, mediaUrls: validDoneUrls };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { text?: string; mediaUrls?: string[] };
      let restored = false;
      if (data.text && typeof data.text === "string") {
        setText(data.text.slice(0, maxChars));
        restored = true;
      }
      const valid = normalizeDraftMediaUrls(data.mediaUrls, maxMedia);
      if (valid.length > 0) {
        const slots: MediaSlot[] = valid.map((url) => ({
          type: "done" as const,
          url,
          kind: inferKindFromUrl(url),
        }));
        setMediaItems(slots);
        restored = true;
      }
      if (restored) toast({ title: "Черновик восстановлен" });
    } catch {
      /* повреждённый черновик */
    }
  }, [maxChars, maxMedia, setText, setMediaItems, toast]);

  /** Только при уходе со страницы: иначе cleanup с [text, mediaUrls] срабатывал каждый рендер (новый массив mediaUrls) и перезаписывал storage устаревшим снимком — в state оставались «восстановленные» слоты, а лимит 10 казался занятым при пустом UI. */
  useEffect(() => {
    return () => {
      const { text: t, mediaUrls: u } = snapshotRef.current;
      if (!t.trim() && u.length === 0) return;
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ text: t, mediaUrls: u }));
      } catch {
        /* localStorage переполнен */
      }
    };
  }, []);

  return {
    clearDraft: () => {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
    },
  };
}
