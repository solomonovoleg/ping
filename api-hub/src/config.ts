import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export type AuthMode = "mock" | "oidc";

export const config = {
  env: process.env.API_HUB_ENV ?? process.env.NODE_ENV ?? "development",
  port: Number(process.env.API_HUB_PORT ?? 3092),
  baseUrl: process.env.API_HUB_BASE_URL ?? "http://localhost:3092",
  logLevel: process.env.API_HUB_LOG_LEVEL ?? "debug",
  jwtSecret: getEnv("API_HUB_JWT_SECRET", "local_dev_secret"),
  encryptionKey: getEnv("API_HUB_ENCRYPTION_KEY", "local_dev_32_bytes_secret_value_12"),
  oauthClientId: getEnv("API_HUB_OAUTH_CLIENT_ID", "hub-client-id"),
  oauthClientSecret: getEnv("API_HUB_OAUTH_CLIENT_SECRET", "hub-client-secret"),
  oauthRedirectUri: getEnv(
    "API_HUB_OAUTH_REDIRECT_URI",
    "http://localhost:3092/v1/auth/ping/callback",
  ),
  dbUrl: process.env.API_HUB_DB_URL ?? "",
  mediaDir: path.resolve(__dirname, "..", process.env.API_HUB_MEDIA_DIR ?? "../tmp-media"),

  authMode: (process.env.API_HUB_AUTH_MODE ?? "mock") as AuthMode,
  /** Issuer base URL, e.g. https://ping.example.com */
  pingOidcIssuer: process.env.API_HUB_PING_OIDC_ISSUER ?? "",
  pingOidcClientId: process.env.API_HUB_PING_OIDC_CLIENT_ID ?? process.env.API_HUB_OAUTH_CLIENT_ID ?? "",
  pingOidcClientSecret:
    process.env.API_HUB_PING_OIDC_CLIENT_SECRET ?? process.env.API_HUB_OAUTH_CLIENT_SECRET ?? "",

  get redisUrl() {
    return process.env.API_HUB_REDIS_URL ?? "";
  },
  redisChannel: process.env.API_HUB_REDIS_CHANNEL ?? "apihub:fanout",

  s3Bucket: process.env.API_HUB_S3_BUCKET ?? "",
  /** Для Cloud.ru и др.: тот же URL, что S3_ENDPOINT на платформе (path-style). Пусто = региональный AWS S3. */
  s3Endpoint: process.env.API_HUB_S3_ENDPOINT ?? "",
  s3Region: process.env.API_HUB_S3_REGION ?? "eu-central-1",
  s3AccessKey: process.env.API_HUB_S3_ACCESS_KEY ?? "",
  s3SecretKey: process.env.API_HUB_S3_SECRET_KEY ?? "",
  s3PublicBaseUrl: process.env.API_HUB_S3_PUBLIC_BASE_URL ?? "",

  /** Main PING platform origin (SPA + API), e.g. https://app.ping.example */
  platformBaseUrl: process.env.API_HUB_PING_PLATFORM_URL ?? "",
  /**
   * Общий секрет с платформой: `POST /internal/api-hub/issue-user-bearer` → Bearer `pm.*` для прокси к `/api/*`.
   * Должен совпадать с `API_HUB_SERVICE_SECRET` на сервере PING.
   */
  hubServiceSecret: process.env.API_HUB_SERVICE_SECRET ?? "",
  /**
   * Секрет для `POST /internal/platform/chat-message` с платформы PING (realtime-мост).
   * Должен совпадать с `API_HUB_BRIDGE_SECRET` на сервере платформы.
   */
  get bridgeSecret() {
    return process.env.API_HUB_BRIDGE_SECRET ?? "";
  },
  /**
   * Если непусто — принимать мост только с этих IP (после `trust proxy`, см. `bridgeTrustForwarded`).
   * Пример: `127.0.0.1,::1,10.0.0.5` (без CIDR).
   */
  get bridgeAllowedIps() {
    return (process.env.API_HUB_BRIDGE_ALLOWED_IPS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },
  /**
   * `1` / `true` — `app.set("trust proxy", 1)` и учёт `X-Forwarded-For` для allowlist (за nginx с одним hop).
   */
  get bridgeTrustForwarded() {
    return (
      process.env.API_HUB_BRIDGE_TRUST_X_FORWARDED === "1" ||
      process.env.API_HUB_BRIDGE_TRUST_X_FORWARDED === "true"
    );
  },
  /** Optional ClamAV REST / TCP bridge URL for media scanning */
  clamavUrl: process.env.API_HUB_CLAMAV_URL ?? "",
};

export type Scope =
  | "profile.read"
  | "chat.read"
  | "chat.write"
  | "presence.write";

export const DEFAULT_SCOPES: Scope[] = [
  "profile.read",
  "chat.read",
  "chat.write",
  "presence.write",
];

export function oidcScopeString(scopes: Scope[]): string {
  const base = ["openid", "offline_access"];
  return [...base, ...scopes].join(" ");
}
