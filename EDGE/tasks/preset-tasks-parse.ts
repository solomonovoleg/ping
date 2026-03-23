/**
 * Реэкспорт парсера пресетов из `shared/` (EDGE + платформа — одна логика).
 */

export {
  type PresetVerify,
  type TaskPresetEntry,
  findTaskPresetByKey,
  listTaskPresetsFromConfig,
  needsEdgeVerify,
  needsPlatformVerify,
  parsePresetVerify,
} from "../../shared/edge-task-preset-config.js";

import { listTaskPresetsFromConfig } from "../../shared/edge-task-preset-config.js";

export function listPublicTaskPresetsFromConfig(configJson: unknown) {
  return listTaskPresetsFromConfig(configJson);
}
