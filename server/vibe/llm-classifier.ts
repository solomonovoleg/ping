/**
 * LLM-based vibe classifier via OpenRouter.
 * Called for deep analysis (every ~20 messages). Falls back to rule-based on any error.
 */
import { callOpenRouter, isOpenRouterConfigured } from "../lib/openrouter";
import { analyzeMessageBatch } from "./rule-analyzer";
import type { VibeBatchResult, VibeThemeCode } from "@shared/chat-vibe-types";
import { VIBE_THEMES } from "@shared/chat-vibe-types";

const VIBE_MODEL = "openai/gpt-4o-mini";

const SYSTEM_PROMPT = `You are a dialogue vibe classifier. Analyze the provided batch of chat messages and return a JSON object.

Available theme codes: ${VIBE_THEMES.join(", ")}

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "dominantPattern": "<theme_code>",
  "secondaryPattern": "<theme_code or null>",
  "confidence": <0.0-1.0>,
  "warmth": <0-100>,
  "tension": <0-100>,
  "playfulness": <0-100>,
  "intimacy": <0-100>,
  "formality": <0-100>,
  "energy": <0-100>,
  "reasonCodes": ["<string>", ...],
  "visualIntensity": <0|1|2>
}

Rules:
- Analyze the OVERALL vibe of the conversation, not individual messages.
- confidence reflects how certain you are about the dominant pattern.
- visualIntensity: 0 = no visual effect, 1 = subtle, 2 = noticeable.
- reasonCodes: short tags explaining the classification (e.g. "laughter_markers", "romantic_language", "business_terminology").
- Messages are in Russian or English. Handle both languages.
- Be conservative: if unsure, default to "casual" with low confidence.`;

function buildUserPrompt(
  texts: string[],
  previousTheme?: VibeThemeCode,
): string {
  const msgs = texts.map((t, i) => `[${i + 1}] ${t}`).join("\n");
  let prompt = `Messages (${texts.length}):\n${msgs}`;
  if (previousTheme) {
    prompt += `\n\nPrevious theme: ${previousTheme}`;
  }
  return prompt;
}

function parseResponse(raw: string): VibeBatchResult | null {
  try {
    const jsonStr = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(jsonStr);

    if (!parsed.dominantPattern || !VIBE_THEMES.includes(parsed.dominantPattern)) return null;

    const axes = {
      warmth: clamp(parsed.warmth ?? 50),
      tension: clamp(parsed.tension ?? 10),
      playfulness: clamp(parsed.playfulness ?? 30),
      intimacy: clamp(parsed.intimacy ?? 20),
      formality: clamp(parsed.formality ?? 30),
      energy: clamp(parsed.energy ?? 40),
    };

    return {
      dominantPattern: parsed.dominantPattern as VibeThemeCode,
      secondaryPattern:
        parsed.secondaryPattern && VIBE_THEMES.includes(parsed.secondaryPattern)
          ? (parsed.secondaryPattern as VibeThemeCode)
          : undefined,
      confidence: clampF(parsed.confidence ?? 0.5),
      axes,
      reasonCodes: Array.isArray(parsed.reasonCodes) ? parsed.reasonCodes : [],
      visualIntensity: [0, 1, 2].includes(parsed.visualIntensity) ? parsed.visualIntensity : 1,
    };
  } catch {
    return null;
  }
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function clampF(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, Math.round(v * 100) / 100));
}

export async function classifyWithLLM(
  texts: string[],
  previousTheme?: VibeThemeCode,
): Promise<VibeBatchResult> {
  if (!isOpenRouterConfigured() || texts.length === 0) {
    return analyzeMessageBatch(texts);
  }

  try {
    const raw = await callOpenRouter(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(texts, previousTheme) },
      ],
      { model: VIBE_MODEL, maxTokens: 512, temperature: 0.3 },
    );

    const result = parseResponse(raw);
    if (result) return result;

    console.warn("[vibe/llm] Failed to parse LLM response, falling back to rule-based");
    return analyzeMessageBatch(texts);
  } catch (err) {
    console.warn("[vibe/llm] LLM call failed, falling back to rule-based:", (err as Error).message);
    return analyzeMessageBatch(texts);
  }
}
