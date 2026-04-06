import { config } from "../config.js";
import { Logger } from "./logger.js";

const logger = new Logger("info");

/**
 * Optional antivirus / moderation hook (61–70): wire `API_HUB_CLAMAV_URL` to a sidecar.
 * No-op when unset.
 */
export async function scanMediaBufferIfConfigured(_buffer: Buffer, _contentType: string): Promise<void> {
  const url = config.clamavUrl?.trim();
  if (!url) return;
  logger.warn("media_scan_stub", {
    message: "API_HUB_CLAMAV_URL is set but scanner integration is not implemented in this build",
    url,
  });
}
