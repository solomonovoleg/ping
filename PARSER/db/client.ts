import { drizzle } from "drizzle-orm/node-postgres";
import { getParserPool } from "./pool.js";
import { vkParserBindings, vkParserItems } from "../../shared/schema/vk-parser.js";

const schema = { vkParserBindings, vkParserItems };

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getParserDb() {
  if (!db) {
    db = drizzle(getParserPool(), { schema });
  }
  return db;
}
