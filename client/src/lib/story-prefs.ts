const STORY_BEAUTY_KEY = "story-beauty-enabled";
const STORY_PREFS_EVENT = "ping:story-prefs-change";

export function getStoryBeautyEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(STORY_BEAUTY_KEY);
  if (raw == null) return true;
  return raw === "1";
}

export function setStoryBeautyEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORY_BEAUTY_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new CustomEvent(STORY_PREFS_EVENT));
}

export function subscribeStoryPrefsChange(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(STORY_PREFS_EVENT, callback);
  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORY_BEAUTY_KEY) callback();
  };
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(STORY_PREFS_EVENT, callback);
    window.removeEventListener("storage", storageHandler);
  };
}
