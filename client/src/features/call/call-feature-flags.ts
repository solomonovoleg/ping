import type { CallFeatureFlags } from "./call-types";

function flagFromEnv(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;

export function getCallFeatureFlags(): CallFeatureFlags {
  return {
    networkQuality: flagFromEnv(env?.VITE_CALLS_FEATURE_NETWORK_QUALITY),
    cameraFlip: flagFromEnv(env?.VITE_CALLS_FEATURE_CAMERA_FLIP),
    screenShare: flagFromEnv(env?.VITE_CALLS_FEATURE_SCREEN_SHARE),
    localRecording: flagFromEnv(env?.VITE_CALLS_FEATURE_LOCAL_RECORDING),
    reactions: flagFromEnv(env?.VITE_CALLS_FEATURE_REACTIONS),
    captionsRelay: flagFromEnv(env?.VITE_CALLS_FEATURE_CAPTIONS_RELAY),
  };
}
