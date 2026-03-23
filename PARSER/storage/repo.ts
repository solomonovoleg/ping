import { and, count, desc, eq } from "drizzle-orm";
import { getParserDb } from "../db/client.js";
import { vkParserBindings, vkParserItems, type VkParserBindingRow } from "../../shared/schema/vk-parser.js";

export async function listBindings(): Promise<VkParserBindingRow[]> {
  const db = getParserDb();
  return db.select().from(vkParserBindings).orderBy(desc(vkParserBindings.createdAt));
}

export async function getBindingById(id: string): Promise<VkParserBindingRow | undefined> {
  const db = getParserDb();
  const [row] = await db.select().from(vkParserBindings).where(eq(vkParserBindings.id, id)).limit(1);
  return row;
}

export async function insertBinding(values: typeof vkParserBindings.$inferInsert): Promise<VkParserBindingRow> {
  const db = getParserDb();
  const [row] = await db.insert(vkParserBindings).values(values).returning();
  if (!row) throw new Error("Не удалось создать привязку");
  return row;
}

export async function updateBinding(
  id: string,
  patch: Partial<typeof vkParserBindings.$inferInsert>,
): Promise<VkParserBindingRow | undefined> {
  const db = getParserDb();
  const [row] = await db
    .update(vkParserBindings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(vkParserBindings.id, id))
    .returning();
  return row;
}

export async function deleteBinding(id: string): Promise<void> {
  const db = getParserDb();
  await db.delete(vkParserBindings).where(eq(vkParserBindings.id, id));
}

export async function itemExistsForVkKey(bindingId: string, vkPostKey: string): Promise<boolean> {
  const db = getParserDb();
  const [row] = await db
    .select({ id: vkParserItems.id })
    .from(vkParserItems)
    .where(and(eq(vkParserItems.bindingId, bindingId), eq(vkParserItems.vkPostKey, vkPostKey)))
    .limit(1);
  return !!row;
}

export async function insertItem(values: typeof vkParserItems.$inferInsert) {
  const db = getParserDb();
  const [row] = await db.insert(vkParserItems).values(values).returning();
  if (!row) throw new Error("Не удалось сохранить элемент очереди");
  return row;
}

export async function updateItem(id: string, patch: Partial<typeof vkParserItems.$inferInsert>) {
  const db = getParserDb();
  const [row] = await db.update(vkParserItems).set(patch).where(eq(vkParserItems.id, id)).returning();
  return row;
}

export async function getItemById(id: string) {
  const db = getParserDb();
  const [row] = await db.select().from(vkParserItems).where(eq(vkParserItems.id, id)).limit(1);
  return row;
}

export async function listItems(opts: {
  bindingId?: string;
  status?: string;
  limit: number;
  offset: number;
}) {
  const db = getParserDb();
  const conditions = [];
  if (opts.bindingId) conditions.push(eq(vkParserItems.bindingId, opts.bindingId));
  if (opts.status) conditions.push(eq(vkParserItems.status, opts.status));
  const base = db.select().from(vkParserItems);
  const filtered = conditions.length ? base.where(and(...conditions)) : base;
  return filtered
    .orderBy(desc(vkParserItems.createdAt))
    .limit(opts.limit)
    .offset(opts.offset);
}

export async function countItems(opts: { bindingId?: string; status?: string }): Promise<number> {
  const db = getParserDb();
  const conditions = [];
  if (opts.bindingId) conditions.push(eq(vkParserItems.bindingId, opts.bindingId));
  if (opts.status) conditions.push(eq(vkParserItems.status, opts.status));
  const base = db.select({ n: count() }).from(vkParserItems);
  const filtered = conditions.length ? base.where(and(...conditions)) : base;
  const [row] = await filtered;
  return Number(row?.n ?? 0);
}

export async function listEnabledBindingsForWorker(): Promise<VkParserBindingRow[]> {
  const db = getParserDb();
  return db.select().from(vkParserBindings).where(eq(vkParserBindings.enabled, true));
}

export async function touchBindingRun(
  id: string,
  patch: { lastRunAt: Date; lastError: string | null; lastCreatedCount: number },
) {
  const db = getParserDb();
  await db
    .update(vkParserBindings)
    .set({
      lastRunAt: patch.lastRunAt,
      lastError: patch.lastError,
      lastCreatedCount: patch.lastCreatedCount,
      updatedAt: new Date(),
    })
    .where(eq(vkParserBindings.id, id));
}
