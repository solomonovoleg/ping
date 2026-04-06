import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type PingCallKitVoipPluginType = {
  getPendingCallKitActions(): Promise<{ actions: Record<string, string>[] }>;
  reportCallEnded(options: { callId: string }): Promise<void>;
  addListener(
    eventName: "pingVoipToken",
    listenerFunc: (ev: { token: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "pingCallKitAction",
    listenerFunc: (ev: Record<string, string>) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
};

export const PingCallKitVoip = registerPlugin<PingCallKitVoipPluginType>("PingCallKitVoip", {
  web: () => ({
    getPendingCallKitActions: async () => ({ actions: [] }),
    reportCallEnded: async () => {},
    addListener: async () => ({ remove: async () => {} }),
    removeAllListeners: async () => {},
  }),
});
