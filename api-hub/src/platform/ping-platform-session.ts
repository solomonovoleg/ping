import { config } from "../config.js";
import { decryptString } from "../security/encryption.js";
import { loadHubSession } from "../services/hub-session.js";

/** Bearer `pm.*` для вызовов `/api/*` платформы (после internal issue или без обмена — null). */
export async function getPingPlatformPmBearer(sessionId: string): Promise<string | null> {
  const session = await loadHubSession(sessionId);
  if (!session?.encryptedPingAccessToken) return null;
  try {
    const t = decryptString(session.encryptedPingAccessToken, config.encryptionKey);
    return t.startsWith("pm.") ? t : null;
  } catch {
    return null;
  }
}
