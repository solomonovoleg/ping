export type { IStorage } from "./types";
export { MemStorage } from "./mem-storage";
export { DbStorage } from "./db-storage";

import type { IStorage } from "./types";
import { MemStorage } from "./mem-storage";
import { DbStorage } from "./db-storage";

function createStorage(): IStorage {
  if (process.env.DATABASE_URL) {
    return new DbStorage();
  }
  return new MemStorage();
}

export const storage = createStorage();
