const AI_DISCLOSURE_PREFIX = "ping:ai-disclosure:";

export type AiDisclosureScope = "ai_chat" | "proofread" | "translate";

function storageKey(scope: AiDisclosureScope): string {
  return `${AI_DISCLOSURE_PREFIX}${scope}`;
}

export function hasAcceptedAiDisclosure(scope: AiDisclosureScope): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey(scope)) === "1";
  } catch {
    return false;
  }
}

export function acceptAiDisclosure(scope: AiDisclosureScope): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(scope), "1");
  } catch {
    /* ignore storage errors */
  }
}
