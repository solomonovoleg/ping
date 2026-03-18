import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ru.pingmoot.app",
  appName: "PING",
  webDir: "dist/public",
  server: {
    // В проде можно оставить пустым (загрузка из webDir).
    // Для отладки с живым сервером: androidScheme: "https", url: "http://10.0.2.2:3080" (эмулятор) или url: "http://YOUR_IP:3080"
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
