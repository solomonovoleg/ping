import os from "os";
import { getCallsRealtimeMetrics } from "../calls/ws";

export type AdminMetricPoint = {
  at: string;
  onlineUsers: number;
  openConnections: number;
  heapUsedMb: number;
  rssMb: number;
  load1m: number;
};

/** ~24 ч при интервале 5 мин */
const CAPACITY = 288;

const ring: AdminMetricPoint[] = [];
let started = false;

export function getAdminMetricSnapshot(): AdminMetricPoint {
  const m = getCallsRealtimeMetrics();
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10;
  const rssMb = Math.round((mem.rss / 1024 / 1024) * 10) / 10;
  const load = os.loadavg();
  return {
    at: new Date().toISOString(),
    onlineUsers: m.onlineUsers,
    openConnections: m.openConnections,
    heapUsedMb,
    rssMb,
    load1m: Math.round(load[0] * 100) / 100,
  };
}

export function recordAdminMetricTick(): AdminMetricPoint {
  const point = getAdminMetricSnapshot();
  ring.push(point);
  while (ring.length > CAPACITY) ring.shift();
  return point;
}

export function startAdminMetricsCollector(): void {
  if (started) return;
  started = true;
  recordAdminMetricTick();
  setInterval(() => recordAdminMetricTick(), 5 * 60 * 1000);
}

export function getAdminMetricHistory(): AdminMetricPoint[] {
  return [...ring];
}
