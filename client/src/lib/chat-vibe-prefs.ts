const KEY_INTENSITY = "ping:vibe-intensity";

export type VibeIntensity = "low" | "medium" | "high";

export function getVibeIntensity(): VibeIntensity {
  const v = localStorage.getItem(KEY_INTENSITY);
  if (v === "low" || v === "medium" || v === "high") return v;
  return "low";
}

export function setVibeIntensity(v: VibeIntensity): void {
  localStorage.setItem(KEY_INTENSITY, v);
}

const INTENSITY_SCALE: Record<VibeIntensity, number> = {
  low: 0.4,
  medium: 0.7,
  high: 1.0,
};

export function getIntensityScale(): number {
  return INTENSITY_SCALE[getVibeIntensity()];
}
