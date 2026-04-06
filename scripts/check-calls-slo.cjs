#!/usr/bin/env node
/**
 * Lightweight SLO checker for 1:1 calls reliability.
 *
 * Usage:
 *   CALLS_SLO_API_URL=https://pingos.ru \
 *   CALLS_SLO_ADMIN_LOGIN=admin \
 *   CALLS_SLO_ADMIN_PASSWORD=secret \
 *   node scripts/check-calls-slo.cjs
 */

const apiOrigin = process.env.CALLS_SLO_API_URL || "";
const login = process.env.CALLS_SLO_ADMIN_LOGIN || "";
const password = process.env.CALLS_SLO_ADMIN_PASSWORD || "";

const thresholdSetupSuccess = Number(process.env.CALLS_SLO_SETUP_SUCCESS_MIN || 98.5);
const thresholdFailedMax = Number(process.env.CALLS_SLO_FAILED_MAX || 1.5);

if (!apiOrigin || !login || !password) {
  console.error(
    "[calls-slo] Missing env vars: CALLS_SLO_API_URL, CALLS_SLO_ADMIN_LOGIN, CALLS_SLO_ADMIN_PASSWORD",
  );
  process.exit(2);
}

async function loginAndGetCookie() {
  const res = await fetch(`${apiOrigin.replace(/\/$/, "")}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login, password }),
  });
  if (!res.ok) throw new Error(`admin login failed: ${res.status}`);
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("admin login missing set-cookie");
  return setCookie.split(";")[0];
}

async function fetchAnalytics(cookie) {
  const res = await fetch(`${apiOrigin.replace(/\/$/, "")}/api/admin/dashboard/analytics`, {
    headers: { cookie },
  });
  if (!res.ok) throw new Error(`analytics fetch failed: ${res.status}`);
  return res.json();
}

function toPct(num, den) {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return 0;
  return (num / den) * 100;
}

async function main() {
  const cookie = await loginAndGetCookie();
  const data = await fetchAnalytics(cookie);
  const calls = data?.callsReliability?.callStateTransition || {};
  const total = Number(calls.total || 0);
  const toConnected = Number(calls.toConnected || 0);
  const toFailed = Number(calls.toFailed || 0);

  const setupSuccessPct = toPct(toConnected, total);
  const failedPct = toPct(toFailed, total);

  console.log("[calls-slo] metrics", {
    total,
    toConnected,
    toFailed,
    setupSuccessPct: Number(setupSuccessPct.toFixed(2)),
    failedPct: Number(failedPct.toFixed(2)),
  });

  const violations = [];
  if (setupSuccessPct < thresholdSetupSuccess) {
    violations.push(`setupSuccessPct ${setupSuccessPct.toFixed(2)} < ${thresholdSetupSuccess}`);
  }
  if (failedPct > thresholdFailedMax) {
    violations.push(`failedPct ${failedPct.toFixed(2)} > ${thresholdFailedMax}`);
  }

  if (violations.length > 0) {
    console.error("[calls-slo] SLO VIOLATION", violations);
    process.exit(1);
  }

  console.log("[calls-slo] ok");
}

main().catch((err) => {
  console.error("[calls-slo] fatal", err);
  process.exit(2);
});
