/** Заголовок для исходящих server-to-server вызовов (корреляция с логами платформы). */
export function outgoingRequestIdHeaders(requestId: string | undefined): Record<string, string> {
  const rid = typeof requestId === "string" ? requestId.trim() : "";
  if (!rid) return {};
  return { "X-Request-Id": rid.slice(0, 120) };
}
