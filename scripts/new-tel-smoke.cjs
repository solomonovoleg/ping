#!/usr/bin/env node
/**
 * Проверка ключей New-Tel без деплоя: вызывает company/get-state с той же схемой подписи, что сервер.
 *
 * Запуск из корня репозитория:
 *   node scripts/new-tel-smoke.cjs
 *   node scripts/new-tel-smoke.cjs ./deploy.env
 *
 * Переменные (достаточно одной пары имён):
 *   NEW_TEL_AUTH_KEY / NEW_TEL_SIGN_KEY  или  NEWTEL_AUTH_KEY / NEWTEL_SIGN_KEY
 * Опционально: NEW_TEL_API_BASE (по умолчанию https://api.new-tel.net)
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function loadEnvFile(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.error("Файл не найден:", abs);
    process.exit(1);
  }
  const text = fs.readFileSync(abs, "utf8");
  for (const line of text.split(/\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const u = t.startsWith("export ") ? t.slice(7).trim() : t;
    const m = u.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function env(name) {
  const v = process.env[name];
  return typeof v === "string" ? v.trim() : "";
}

function envFirst(...names) {
  for (const n of names) {
    const v = env(n);
    if (v) return v;
  }
  return "";
}

function normalizeKey(raw) {
  let v = raw.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v.toLowerCase();
}

function getBase() {
  const raw = envFirst("NEW_TEL_API_BASE", "NEWTEL_BASE_URL", "NEWTEL_API_URL").replace(/\/+$/, "");
  if (!raw) return "https://api.new-tel.net";
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return "https://api.new-tel.net";
    return u.origin;
  } catch {
    return "https://api.new-tel.net";
  }
}

function token(methodName, payloadJson, unixSec, authKey, signKey) {
  const timeStr = String(unixSec);
  const base = `${methodName}\n${timeStr}\n${authKey}\n${payloadJson}\n${signKey}`;
  const sig = crypto.createHash("sha256").update(base, "utf8").digest("hex");
  return `${authKey}${timeStr}${sig}`;
}

async function main() {
  const envFile = process.argv[2];
  if (envFile) loadEnvFile(envFile);
  else {
    try {
      require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
    } catch {
      /* optional */
    }
  }

  const authRaw = envFirst("NEW_TEL_AUTH_KEY", "NEWTEL_AUTH_KEY");
  const signRaw = envFirst("NEW_TEL_SIGN_KEY", "NEWTEL_SIGN_KEY");
  const authKey = normalizeKey(authRaw);
  const signKey = normalizeKey(signRaw);

  if (!authKey || !signKey) {
    console.error(
      "Нет ключей. Задай NEW_TEL_AUTH_KEY + NEW_TEL_SIGN_KEY (или NEWTEL_AUTH_KEY + NEWTEL_SIGN_KEY) в .env / deploy.env и запусти:\n  node scripts/new-tel-smoke.cjs ./deploy.env",
    );
    process.exit(1);
  }

  const hex48 = /^[0-9a-f]{48}$/;
  if (!hex48.test(authKey) || !hex48.test(signKey)) {
    console.error(
      "Каждый ключ должен быть ровно 48 hex-символов (a–f, 0–9). Сейчас длины:",
      authKey.length,
      signKey.length,
    );
    process.exit(1);
  }

  const method = "company/get-state";
  const body = "{}";
  const unixSec = Math.floor(Date.now() / 1000);
  const t = token(method, body, unixSec, authKey, signKey);
  const base = getBase();
  const url = `${base}/${method}`;

  console.log("POST", url);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${t}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    console.error("HTTP", res.status, text.slice(0, 500));
    process.exit(1);
  }
  console.log("HTTP", res.status, JSON.stringify(json, null, 2));

  if (json && json.status === "success" && json.data && json.data.result === "success") {
    console.log("\nOK: подпись и ключи приняты New-Tel (company/get-state).");
    process.exit(0);
  }
  console.error("\nFAIL: ответ не success — смотри message/data.message выше или пиши в поддержку New-Tel.");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
