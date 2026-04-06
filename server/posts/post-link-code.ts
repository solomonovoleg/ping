import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { posts } from "@shared/schema";
import { getDb } from "../db";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function randomPostLinkCode(length = 10): string {
  const buf = randomBytes(length);
  let s = "";
  for (let i = 0; i < length; i++) s += ALPHABET[buf[i]! % ALPHABET.length]!;
  return s;
}

export async function mintUniquePostLinkCode(): Promise<string> {
  const db = getDb();
  for (let i = 0; i < 32; i++) {
    const code = randomPostLinkCode(10);
    const [hit] = await db.select({ id: posts.id }).from(posts).where(eq(posts.linkCode, code)).limit(1);
    if (!hit) return code;
  }
  throw new Error("mintUniquePostLinkCode: exhausted retries");
}
