import { Capacitor } from "@capacitor/core";
import { isNative } from "@/lib/capacitor-native";

export async function notifyIosCallKitCallEndedIfNeeded(callId: string): Promise<void> {
  if (!callId || !isNative() || Capacitor.getPlatform() !== "ios") return;
  try {
    const { PingCallKitVoip } = await import("@/lib/ping-callkit-voip");
    await PingCallKitVoip.reportCallEnded({ callId });
  } catch {
    /* плагин отсутствует в веб-сборке */
  }
}
