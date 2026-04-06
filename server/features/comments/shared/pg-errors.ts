export function pgErrorCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) return String((err as { code?: string }).code);
  const cause = err && typeof err === "object" && "cause" in err ? (err as { cause?: unknown }).cause : undefined;
  if (cause && typeof cause === "object" && cause !== null && "code" in cause) {
    return String((cause as { code?: string }).code);
  }
  return "";
}

export function pgErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  const cause = err && typeof err === "object" && "cause" in err ? (err as { cause?: unknown }).cause : undefined;
  if (cause instanceof Error) return cause.message;
  return String(err);
}
