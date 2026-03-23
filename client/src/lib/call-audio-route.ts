/**
 * Маршрут вывода звука при голосовом звонке (громкая связь ↔ разговорный динамик).
 * В браузере API нет — no-op. На iOS/Android — нативный плагин `CallAudioRoute`.
 */
import { registerPlugin, WebPlugin } from "@capacitor/core";
import { isNative } from "@/lib/capacitor-native";

export type CallAudioOutputMode = "speaker" | "earpiece";

export interface CallAudioRoutePluginContract {
  setOutputRoute(options: { mode: CallAudioOutputMode }): Promise<void>;
}

class CallAudioRouteWeb extends WebPlugin implements CallAudioRoutePluginContract {
  async setOutputRoute(): Promise<void> {
    /* WebRTC в браузере не даёт надёжно выбрать динамик vs разговорник */
  }
}

export const CallAudioRoute = registerPlugin<CallAudioRoutePluginContract>("CallAudioRoute", {
  web: () => new CallAudioRouteWeb(),
});

export function isCallAudioRouteSupported(): boolean {
  return isNative();
}

export async function applyCallAudioOutputRoute(speaker: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    await CallAudioRoute.setOutputRoute({ mode: speaker ? "speaker" : "earpiece" });
  } catch (e) {
    console.warn("[call-audio-route] setOutputRoute failed", e);
  }
}
