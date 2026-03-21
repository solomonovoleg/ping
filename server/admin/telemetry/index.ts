/**
 * Телеметрия API по доменным модулям (админка → Операции).
 * Слои: registry (пути), hints (подсказки), store (память), middleware, HTTP.
 */
export type { ModuleTelemetryRow, ModulesTelemetryPayload, TelemetryRecentError } from "./types";
export { resolveApiModule, MODULE_LABELS_RU } from "./api-module-registry";
export { telemetryHintsForHttpError } from "./error-hints";
export { getModulesTelemetryPayload, recordApiTrafficFinish } from "./api-traffic-store";
export { apiTrafficModuleTelemetryMiddleware } from "./api-traffic-middleware";
export { registerAdminModulesTelemetryRoutes } from "./modules.admin-http";
