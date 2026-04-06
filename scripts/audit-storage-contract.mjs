#!/usr/bin/env node
/**
 * Сверка имён методов IStorage с DbStorage и MemStorage (дополнение к tsc: implements IStorage).
 * Запуск: node scripts/audit-storage-contract.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function sliceIStorageBody(typesSrc) {
  const start = typesSrc.indexOf("export interface IStorage");
  if (start < 0) throw new Error("IStorage not found");
  const bodyStart = typesSrc.indexOf("{", start);
  let depth = 0;
  for (let i = bodyStart; i < typesSrc.length; i++) {
    const c = typesSrc[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return typesSrc.slice(bodyStart + 1, i);
    }
  }
  throw new Error("Unclosed IStorage");
}

function methodNamesFromIface(body) {
  const re = /^\s{2}([a-zA-Z][a-zA-Z0-9]*)\s*\(/gm;
  return [...body.matchAll(re)].map((m) => m[1]);
}

function asyncMethodNamesFromClass(src) {
  const re = /^\s{2}async ([a-zA-Z][a-zA-Z0-9]*)\s*\(/gm;
  return [...src.matchAll(re)].map((m) => m[1]);
}

const typesPath = path.join(root, "server/storage/types.ts");
const dbPath = path.join(root, "server/storage/db-storage.ts");
const memPath = path.join(root, "server/storage/mem-storage.ts");

const typesSrc = fs.readFileSync(typesPath, "utf8");
const dbSrc = fs.readFileSync(dbPath, "utf8");
const memSrc = fs.readFileSync(memPath, "utf8");

const iface = sliceIStorageBody(typesSrc);
const iNames = methodNamesFromIface(iface);
const iSet = new Set(iNames);
const dbSet = new Set(asyncMethodNamesFromClass(dbSrc));
const memSet = new Set(asyncMethodNamesFromClass(memSrc));

const dup = iNames.filter((n, idx) => iNames.indexOf(n) !== idx);
if (dup.length) {
  console.error("Duplicate method names in IStorage slice:", [...new Set(dup)].join(", "));
  process.exit(1);
}

const missingDb = [...iSet].filter((n) => !dbSet.has(n)).sort();
const missingMem = [...iSet].filter((n) => !memSet.has(n)).sort();
const extraDb = [...dbSet].filter((n) => !iSet.has(n)).sort();
const extraMem = [...memSet].filter((n) => !iSet.has(n)).sort();

console.log(`IStorage methods: ${iSet.size}`);
console.log(`DbStorage async methods: ${dbSet.size}`);
console.log(`MemStorage async methods: ${memSet.size}`);

let ok = true;
if (missingDb.length) {
  console.error("Missing in DbStorage:", missingDb.join(", "));
  ok = false;
}
if (missingMem.length) {
  console.error("Missing in MemStorage:", missingMem.join(", "));
  ok = false;
}
if (extraDb.length) {
  console.error("Extra in DbStorage (not in IStorage):", extraDb.join(", "));
  ok = false;
}
if (extraMem.length) {
  console.error("Extra in MemStorage (not in IStorage):", extraMem.join(", "));
  ok = false;
}

function auditDbStorageSegmentsNoCycle() {
  const storageDir = path.join(root, "server/storage");
  const files = fs
    .readdirSync(storageDir)
    .filter((f) => f.startsWith("db-storage-segment-") && f.endsWith(".ts"));
  const bad = [];
  for (const f of files) {
    const p = path.join(storageDir, f);
    const s = fs.readFileSync(p, "utf8");
    if (/\bfrom\s+["']\.\/db-storage["']/.test(s)) bad.push(f);
  }
  if (bad.length) {
    console.error(
      "db-storage segments must not import ./db-storage (cycle risk):",
      bad.join(", "),
    );
    return false;
  }
  return true;
}

if (!auditDbStorageSegmentsNoCycle()) ok = false;

if (!ok) process.exit(1);
console.log("audit-storage-contract: OK (names align with IStorage, segment imports clean)");
