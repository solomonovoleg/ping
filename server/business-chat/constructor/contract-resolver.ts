import type { AutoConnectInput } from "../types";

function toAbsoluteUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, base).toString();
}

export async function resolveBusinessContract(input: AutoConnectInput): Promise<unknown> {
  const endpoint = input.endpointUrl.trim();
  const apiKey = input.apiKey.trim();
  const candidates = [
    input.contractUrl?.trim() || "",
    toAbsoluteUrl(endpoint, "/.well-known/business-chat-contract"),
    toAbsoluteUrl(endpoint, "/openapi.json"),
  ].filter(Boolean);

  const headers: Record<string, string> = {
    "Accept": "application/json",
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  let lastError: unknown;
  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: "GET", headers });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} at ${url}`);
        continue;
      }
      const payload = await res.json();
      if (payload && typeof payload === "object") return payload;
      lastError = new Error(`Unsupported contract payload at ${url}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Не удалось получить контракт интеграции");
}
