import { Platform } from "react-native";

export type MobileCallCapabilities = {
  supportsWebRtcFeatures: boolean;
  fallbackMode: "tel";
};

/**
 * Единый слой возможностей для мобильного клиента.
 * Пока WebRTC-модуль не внедрен, сохраняем безопасный fallback на системный tel:-звонок.
 */
export function getMobileCallCapabilities(): MobileCallCapabilities {
  return {
    supportsWebRtcFeatures: false,
    fallbackMode: Platform.OS === "ios" || Platform.OS === "android" ? "tel" : "tel",
  };
}
