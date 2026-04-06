#!/usr/bin/env node
/**
 * Сборка только ./gradlew без `npm run build && npx cap sync android` даёт пустой/старый WebView → белый экран.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const index = path.join(root, "android/app/src/main/assets/public/index.html");

if (!existsSync(index)) {
  console.error(
    "\n[android] Нет android/app/src/main/assets/public/index.html — веб-бандл не скопирован в проект.\n" +
      "  Сделай:  npm run build:android   (или android:apk:full)\n" +
      "  Не собирай только:  cd android && ./gradlew assembleDebug\n"
  );
  process.exit(1);
}
