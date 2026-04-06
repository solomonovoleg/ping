const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-3.5-turbo";
const OPENROUTER_TIMEOUT_MS = 25_000;

export type OpenRouterMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type CallOpenRouterOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

export async function callOpenRouter(
  messages: OpenRouterMessage[],
  opts?: CallOpenRouterOptions,
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const model = opts?.model ?? process.env.OPENROUTER_MODEL?.trim() ?? DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: opts?.maxTokens ?? 2048,
        ...(opts?.temperature !== undefined && { temperature: opts.temperature }),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OpenRouter: timeout");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter: ${res.status} ${errText}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

export function isOpenRouterConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY?.trim();
}
