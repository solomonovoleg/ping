#!/usr/bin/env node
/**
 * Копирует эталон логотипа в assets/ для @capacitor/assets (easy mode: assets/logo.png).
 * Источник правды — client/public/logo.png (тот же, что на экране входа).
 */
import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "client/public/logo.png");
const destDir = path.join(root, "assets");
const dest = path.join(destDir, "logo.png");

if (!existsSync(src)) {
  console.error("[capacitor-assets] Нет файла client/public/logo.png");
  process.exit(1);
}

await mkdir(destDir, { recursive: true });
await copyFile(src, dest);
