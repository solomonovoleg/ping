import { useEffect, useRef } from "react";

/** Общий редактор поста (без edgeId). v2 — чтобы не подтягивать старый общий ключ, куда попадали длинные EDGE-тексты. */
export const CREATE_POST_GENERAL_DRAFT_KEY = "ping_create_post_draft_v2";
const CREATE_POST_LEGACY_DRAFT_KEY = "ping_create_post_draft";

export function createPostDraftStorageKey(presetEdgeId: string): string {
  const e = presetEdgeId.trim();
  if (e) return `ping_create_post_draft_edge_${encodeURIComponent(e)}`;
  return CREATE_POST_GENERAL_DRAFT_KEY;
}

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
  storageKey: string,
  maxChars: number,
  maxMedia: number,
  text: string,
  setText: (v: string) => void,
  mediaItems: MediaSlot[],
  setMediaItems: (v: MediaSlot[] | ((prev: MediaSlot[]) => MediaSlot[])) => void,
  toast: (opts: { title: string }) => void,
  options?: { skip?: boolean }
) {
  const skip = options?.skip === true;
  const snapshotRef = useRef({ text: "", mediaUrls: [] as string[] });
  /** После успешной публикации `clearDraft()` — не писать черновик в cleanup unmount (иначе тот же текст/медиа снова попадут в storage). */
  const skipUnmountPersistRef = useRef(false);
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

  /** Сброс при смене ключа (общий пост ↔ пост с edgeId), чтобы подтянуть правильный черновик. */
  const didRestoreRef = useRef(false);
  useEffect(() => {
    if (skip) return;
    didRestoreRef.current = false;
  }, [skip, storageKey]);

  useEffect(() => {
    if (skip) return;
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;
    try {
      if (storageKey === CREATE_POST_GENERAL_DRAFT_KEY) {
        try {
          localStorage.removeItem(CREATE_POST_LEGACY_DRAFT_KEY);
        } catch {
          /* ignore */
        }
      }
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setText("");
        setMediaItems([]);
        return;
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- один проход на пару skip+storageKey; set* стабильны
  }, [skip, storageKey, maxChars, maxMedia]);

  /** Только при уходе со страницы: иначе cleanup с [text, mediaUrls] срабатывал каждый рендер (новый массив mediaUrls) и перезаписывал storage устаревшим снимком — в state оставались «восстановленные» слоты, а лимит 10 казался занятым при пустом UI. */
  useEffect(() => {
    if (skip) return;
    return () => {
      if (skipUnmountPersistRef.current) return;
      const { text: t, mediaUrls: u } = snapshotRef.current;
      if (!t.trim() && u.length === 0) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify({ text: t, mediaUrls: u }));
      } catch {
        /* localStorage переполнен */
      }
    };
  }, [skip, storageKey]);

  return {
    clearDraft: () => {
      if (skip) return;
      skipUnmountPersistRef.current = true;
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    },
  };
}
