import { asRecord } from "./as-record.js";

export function readDisplayAudience(configJson: unknown): "self" | "followers" | "public" {
  const root = asRecord(configJson);
  const raw = root.displayAudience;
  const s = typeof raw === "string" ? raw.toLowerCase().trim() : "public";
  if (s === "self" || s === "followers") return s;
  return "public";
}
