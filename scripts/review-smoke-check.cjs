#!/usr/bin/env node
"use strict";

/**
 * Быстрый smoke-check перед App Store / Google Play review.
 *
 * Использование:
 *   BASE_URL=https://pingos.ru SESSION_COOKIE="connect.sid=..." node scripts/review-smoke-check.cjs
 *
 * Что проверяет:
 * 1) /api/admin/dashboard/review-readiness
 * 2) /api/posts?limit=1
 * 3) /api/stories/feed?limit=1
 * 4) /api/users/search?q=test
 * 5) /api/calls/token
 */

const DEFAULT_BASE_URL = "http://localhost:5000";
const fs = require("fs");
const path = require("path");

function getConfig() {
  const baseUrl = (process.env.BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const sessionCookie = process.env.SESSION_COOKIE || "";
  const mode = process.argv.includes("--public") ? "public" : "auth";
  const reportFile = process.env.REVIEW_SMOKE_REPORT_FILE || "review-smoke-report.json";
  return { baseUrl, sessionCookie, mode, reportFile };
}

async function getJson(baseUrl, path, sessionCookie, method = "GET") {
  const headers = { Accept: "application/json" };
  if (sessionCookie) headers.Cookie = sessionCookie;
  const response = await fetch(`${baseUrl}${path}`, { method, headers });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { ok: response.ok, status: response.status, body };
}

function printResult(name, result) {
  const mark = result.ok ? "OK" : "FAIL";
  const code = typeof result.body?.code === "string" ? ` code=${result.body.code}` : "";
  const message = typeof result.body?.message === "string" ? ` message="${result.body.message}"` : "";
  console.log(`[${mark}] ${name} status=${result.status}${code}${message}`);
}

async function checkCallsWs(baseUrl, token) {
  const { WebSocket } = require("ws");
  const wsBase = baseUrl.replace(/^http/i, "ws");
  const url = `${wsBase}/calls?token=${encodeURIComponent(token)}`;
  return await new Promise((resolve) => {
    let settled = false;
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.terminate(); } catch {}
      resolve({ ok: false, status: 0, body: { message: "WS timeout" } });
    }, 7000);

    ws.on("open", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(1000); } catch {}
      resolve({ ok: true, status: 101, body: { message: "WS upgraded" } });
    });
    ws.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, status: 0, body: { message: err?.message || "WS error" } });
    });
  });
}

async function main() {
  const { baseUrl, sessionCookie, mode, reportFile } = getConfig();
  console.log(`Smoke check target: ${baseUrl} (mode=${mode})`);
  if (mode === "auth" && !sessionCookie) {
    console.warn("SESSION_COOKIE не задан. Перехожу в public-режим.");
  }

  const effectiveMode = mode === "public" || !sessionCookie ? "public" : "auth";
  const checks = effectiveMode === "auth"
    ? [
        ["admin_review_readiness", "/api/admin/dashboard/review-readiness"],
        ["open_post", "/api/posts?limit=1"],
        ["view_stories", "/api/stories/feed?limit=1"],
        ["open_profile_search", "/api/users/search?q=test"],
      ]
    : [
        ["edge_health_public", "/api/edge/health"],
        ["open_post_by_id_public", "/api/posts/invalid-id"],
      ];

  let hasFailures = false;
  const report = {
    target: baseUrl,
    mode: effectiveMode,
    startedAt: new Date().toISOString(),
    checks: [],
  };
  for (const [name, path] of checks) {
    const result = await getJson(baseUrl, path, sessionCookie, "GET");
    printResult(name, result);
    report.checks.push({
      name,
      path,
      ok: result.ok,
      status: result.status,
      code: typeof result.body?.code === "string" ? result.body.code : null,
      message: typeof result.body?.message === "string" ? result.body.message : null,
    });
    if (!result.ok) hasFailures = true;
  }

  if (effectiveMode === "auth") {
    const callToken = await getJson(baseUrl, "/api/calls/token", sessionCookie, "POST");
    printResult("make_call_token", callToken);
    report.checks.push({
      name: "make_call_token",
      path: "/api/calls/token",
      ok: callToken.ok,
      status: callToken.status,
      code: typeof callToken.body?.code === "string" ? callToken.body.code : null,
      message: typeof callToken.body?.message === "string" ? callToken.body.message : null,
      ttl: typeof callToken.body?.expiresInSeconds === "number" ? callToken.body.expiresInSeconds : null,
    });
    if (callToken.ok) {
      const ttl = callToken.body?.expiresInSeconds;
      if (typeof ttl === "number") {
        console.log(`[INFO] make_call_token ttl=${ttl}s`);
      }
      const token = typeof callToken.body?.token === "string" ? callToken.body.token : "";
      if (token) {
        const wsResult = await checkCallsWs(baseUrl, token);
        printResult("make_call_ws_upgrade", wsResult);
        report.checks.push({
          name: "make_call_ws_upgrade",
          path: "/calls",
          ok: wsResult.ok,
          status: wsResult.status,
          code: typeof wsResult.body?.code === "string" ? wsResult.body.code : null,
          message: typeof wsResult.body?.message === "string" ? wsResult.body.message : null,
        });
        if (!wsResult.ok) hasFailures = true;
      }
    } else {
      hasFailures = true;
    }
  }

  report.finishedAt = new Date().toISOString();
  report.ok = !hasFailures;
  const outputPath = path.resolve(process.cwd(), reportFile);
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  console.log(`[INFO] report saved: ${outputPath}`);

  if (hasFailures) {
    console.error("\nSmoke check завершён с ошибками.");
    process.exit(1);
  }
  console.log("\nSmoke check пройден.");
}

main().catch((error) => {
  console.error("Smoke check fatal:", error?.message || error);
  process.exit(1);
});
