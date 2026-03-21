import { STORY_SOUND_PREF_KEY } from "./constants";

export function getInitialStorySoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORY_SOUND_PREF_KEY) === "1";
}
