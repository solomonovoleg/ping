import type { Express } from "express";

/**
 * API для EDGE Companion. Клиент: `/edge/companion`.
 * Пока маршрутов нет — регистратор нужен для связки с `registerEdgeRoutes` в `server/routes.ts`.
 */
export function registerEdgeRoutes(_app: Express): void {}
