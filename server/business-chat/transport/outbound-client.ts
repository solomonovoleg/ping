import { signBusinessPayload } from "./idempotency";

type OutboundRequest = {
  endpointUrl: string;
  apiKey: string;
  payload: unknown;
};

export async function sendBusinessOutbound(request: OutboundRequest): Promise<{ status: number; body: string }> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payloadJson = JSON.stringify(request.payload);
  const signature = signBusinessPayload(payloadJson, timestamp, request.apiKey);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Business-Timestamp": timestamp,
    "X-Business-Signature": signature,
  };
  if (request.apiKey.trim()) headers["Authorization"] = `Bearer ${request.apiKey.trim()}`;
  const res = await fetch(request.endpointUrl, {
    method: "POST",
    headers,
    body: payloadJson,
  });
  const body = await res.text().catch(() => "");
  return { status: res.status, body };
}
