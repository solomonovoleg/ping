#!/usr/bin/env node
/**
 * Копирует единственный debug APK из Gradle-вывода в dist/ у корня репо (удобно искать, не лазить в android/...).
 */
import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const debugDir = path.join(root, "android/app/build/outputs/apk/debug");
const outDir = path.join(root, "dist");

const names = await readdir(debugDir);
const apkName = names.find((f) => f.endsWith(".apk") && f !== "output-metadata.json");
if (!apkName) {
  console.error("[copy-apk] В", debugDir, "нет .apk — сначала собери: npm run android:apk");
  process.exit(1);
}
await mkdir(outDir, { recursive: true });
const src = path.join(debugDir, apkName);
const dest = path.join(outDir, apkName);
await copyFile(src, dest);
console.log("[copy-apk]", dest);
