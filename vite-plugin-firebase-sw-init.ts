import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { loadEnv } from "vite";

/** Совместимо с importScripts в client/public/firebase-messaging-sw.js */
export const FIREBASE_JS_CDN_VERSION = "11.10.0";

function writeFirebaseSwInit(publicDir: string, env: Record<string, string>): void {
  const apiKey = env.VITE_FIREBASE_API_KEY?.trim();
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = env.VITE_FIREBASE_PROJECT_ID?.trim();
  const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET?.trim();
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim();
  const appId = env.VITE_FIREBASE_APP_ID?.trim();

  const complete =
    apiKey &&
    authDomain &&
    projectId &&
    messagingSenderId &&
    appId;

  let body: string;
  if (complete) {
    const config = {
      apiKey,
      authDomain,
      projectId,
      storageBucket: storageBucket || `${projectId}.appspot.com`,
      messagingSenderId,
      appId,
    };
    body = `firebase.initializeApp(${JSON.stringify(config)});`;
  } else {
    body =
      "// FCM web: задайте VITE_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID, MESSAGING_SENDER_ID, APP_ID в .env и перезапустите dev/build.\n";
  }

  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, "firebase-sw-init.js"), body, "utf-8");
}

/**
 * Пишет client/public/firebase-sw-init.js из VITE_FIREBASE_* (тот же проект, что iOS/Android).
 * Service worker не может читать import.meta.env — только этот файл.
 */
export function firebaseSwInitPlugin(repoRoot: string): Plugin {
  return {
    name: "firebase-sw-init",
    buildStart() {
      const mode =
        process.env.NODE_ENV === "production" ? "production" : "development";
      const env = loadEnv(mode, repoRoot, "VITE_");
      writeFirebaseSwInit(path.join(repoRoot, "client", "public"), env);
    },
    configureServer(server) {
      const env = loadEnv(server.config.mode, repoRoot, "VITE_");
      writeFirebaseSwInit(path.join(server.config.root, "public"), env);
    },
  };
}
