/**
 * Detect code blocks in message content.
 *
 * Two types:
 * 1. Explicit: markdown-style triple backticks (```lang\ncode\n```)
 * 2. Auto-detected: obvious code patterns (HTML tags, braces, semicolons, etc.)
 *
 * Returns parsed segments for rendering: either {type:"text"} or {type:"code"}.
 */

export type MessageSegment =
  | { type: "text"; content: string }
  | { type: "code"; content: string; lang: string | null };

const FENCE_RE = /```(\w*)\n([\s\S]*?)```/g;

/** Detect if raw text looks like code (no fences). */
function looksLikeCode(text: string): { isCode: boolean; lang: string | null } {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 8) return { isCode: false, lang: null };

  const lines = trimmed.split("\n");
  const lineCount = lines.length;

  // HTML: opening/closing tags
  if (/<\/?[a-z][a-z0-9-]*[\s>/]/i.test(trimmed) && (trimmed.includes("</") || trimmed.includes("/>") || /<html|<div|<span|<p |<head|<body|<img|<a |<ul|<li|<table|<form|<input|<button|<script|<style|<link|<meta/i.test(trimmed))) {
    return { isCode: true, lang: "html" };
  }

  // CSS: selectors + braces + properties
  if (/[.#][\w-]+\s*\{/.test(trimmed) && /:\s*[\w#]/.test(trimmed)) {
    return { isCode: true, lang: "css" };
  }

  // JSON: starts with { or [ and contains quoted keys
  if (/^\s*[\[{]/.test(trimmed) && /"\w+":\s/.test(trimmed)) {
    return { isCode: true, lang: "json" };
  }

  // Python: def/class/import with indentation
  if (/(^|\n)\s*(def |class |import |from .* import |if __name__)/.test(trimmed) && lineCount >= 2) {
    return { isCode: true, lang: "python" };
  }

  // JS/TS: function/const/let/var/import/export with braces
  if (/(^|\n)\s*(function |const |let |var |import |export |=>|async )/.test(trimmed) && /[{};]/.test(trimmed) && lineCount >= 2) {
    return { isCode: true, lang: "js" };
  }

  // SQL
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/i.test(trimmed) && lineCount >= 1) {
    return { isCode: true, lang: "sql" };
  }

  // Shell: lines starting with $ or # (not markdown headers)
  if (lineCount >= 2 && lines.filter((l) => /^\s*[$#]\s/.test(l)).length >= Math.ceil(lineCount * 0.4)) {
    return { isCode: true, lang: "shell" };
  }

  // Generic code: lots of braces/semicolons + indentation
  const braceCount = (trimmed.match(/[{}()[\];]/g) || []).length;
  const indentedLines = lines.filter((l) => /^\s{2,}/.test(l)).length;
  if (lineCount >= 3 && braceCount >= 4 && indentedLines >= Math.ceil(lineCount * 0.3)) {
    return { isCode: true, lang: null };
  }

  return { isCode: false, lang: null };
}

/** Parse message content into text + code segments. */
export function parseCodeSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;

  // First pass: extract fenced code blocks (```...```)
  let match: RegExpExecArray | null;
  FENCE_RE.lastIndex = 0;
  while ((match = FENCE_RE.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const before = content.slice(lastIndex, match.index).trim();
      if (before) segments.push({ type: "text", content: before });
    }
    segments.push({
      type: "code",
      content: match[2].replace(/\n$/, ""),
      lang: match[1] || null,
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);
    // If there were no fences at all, check if entire message is code
    if (segments.length === 0) {
      const { isCode, lang } = looksLikeCode(remaining);
      if (isCode) {
        segments.push({ type: "code", content: remaining.trim(), lang });
        return segments;
      }
    }
    const trimmed = remaining.trim();
    if (trimmed) segments.push({ type: "text", content: trimmed });
  }

  return segments.length > 0 ? segments : [{ type: "text", content }];
}

/** Quick check: does this message contain any code? */
export function hasCodeContent(content: string): boolean {
  if (FENCE_RE.test(content)) {
    FENCE_RE.lastIndex = 0;
    return true;
  }
  return looksLikeCode(content).isCode;
}
