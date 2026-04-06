import type { NextFunction, Request, Response } from "express";

let httpRequests = 0;
let httpErrors5xx = 0;
let realtimeEvents = 0;
let bridgeRequestsTotal = 0;
let bridgeAccepted202 = 0;
let bridgeAuth401 = 0;
let bridgeForbiddenIp403 = 0;
let bridgeNotConfigured503 = 0;
let bridgeValidation400 = 0;
let bridgeEventsEmitted = 0;
let bridgeIdempotentDuplicates = 0;

export function bumpHttpRequest(): void {
  httpRequests += 1;
}

export function bumpHttp5xx(): void {
  httpErrors5xx += 1;
}

export function bumpRealtimeEvent(): void {
  realtimeEvents += 1;
}

export function bumpBridgeRequest(): void {
  bridgeRequestsTotal += 1;
}

export function bumpBridgeAccepted(emitCount: number): void {
  bridgeAccepted202 += 1;
  bridgeEventsEmitted += Math.max(0, emitCount);
}

export function bumpBridgeAuth401(): void {
  bridgeAuth401 += 1;
}

export function bumpBridgeForbiddenIp(): void {
  bridgeForbiddenIp403 += 1;
}

export function bumpBridgeNotConfigured503(): void {
  bridgeNotConfigured503 += 1;
}

export function bumpBridgeValidation400(): void {
  bridgeValidation400 += 1;
}

export function bumpBridgeIdempotentDuplicate(): void {
  bridgeIdempotentDuplicates += 1;
}

export function getMetricsSnapshot() {
  return {
    http_requests_total: httpRequests,
    http_errors_5xx_total: httpErrors5xx,
    realtime_events_total: realtimeEvents,
    bridge_requests_total: bridgeRequestsTotal,
    bridge_accepted_202_total: bridgeAccepted202,
    bridge_auth_401_total: bridgeAuth401,
    bridge_forbidden_ip_403_total: bridgeForbiddenIp403,
    bridge_not_configured_503_total: bridgeNotConfigured503,
    bridge_validation_400_total: bridgeValidation400,
    bridge_events_emitted_total: bridgeEventsEmitted,
    bridge_idempotent_duplicates_total: bridgeIdempotentDuplicates,
  };
}

export function requestMetrics(req: Request, res: Response, next: NextFunction): void {
  bumpHttpRequest();
  const done = () => {
    res.removeListener("finish", done);
    if (res.statusCode >= 500) bumpHttp5xx();
  };
  res.on("finish", done);
  next();
}
