import { useEffect, useRef } from "react";

const DRAFT_STORAGE_KEY = "create-post-draft-v1";

type MediaItem = unknown;
type SetText = (value: string) => void;
type SetMediaItems = (items: MediaItem[]) => void;

type ToastFn = (opts: { title: string; variant?: "default" | "destructive" }) => void;

type DraftPayload = {
  text: string;
  mediaItems: MediaItem[];
};

export function useCreatePostDraft(
  maxChars: number,
  _maxMedia: number,
  text: string,
  setText: SetText,
  mediaItems: MediaItem[],
  setMediaItems: SetMediaItems,
  toast?: ToastFn,
): { clearDraft: () => void } {
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<DraftPayload>;

      if (typeof parsed.text === "string" && parsed.text.length > 0) {
        setText(parsed.text.slice(0, maxChars));
      }
      if (Array.isArray(parsed.mediaItems) && parsed.mediaItems.length > 0) {
        setMediaItems(parsed.mediaItems);
      }
      if (toast && (parsed.text || (parsed.mediaItems && parsed.mediaItems.length))) {
        toast({ title: "Черновик восстановлен" });
      }
    } catch {
      // Ignore invalid draft payloads.
    }
  }, [maxChars, setMediaItems, setText, toast]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const payload: DraftPayload = {
        text: text.slice(0, maxChars),
        mediaItems: Array.isArray(mediaItems) ? mediaItems : [],
      };
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore localStorage write errors in private mode/quota limits.
    }
  }, [text, mediaItems, maxChars]);

  const clearDraft = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Ignore localStorage errors.
    }
  };

  return { clearDraft };
}
