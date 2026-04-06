import { and, asc, desc, eq, lte, or } from "drizzle-orm";
import { businessActions, businessContracts, businessEvents, businessWidgets } from "@shared/schema";
import { getDb } from "../db";
import type { ConstructorAction } from "./types";

export type BusinessWidgetRow = typeof businessWidgets.$inferSelect;
export type BusinessActionRow = typeof businessActions.$inferSelect;
export type BusinessEventRow = typeof businessEvents.$inferSelect;

export async function getBusinessWidgetById(widgetId: string): Promise<BusinessWidgetRow | null> {
  const db = getDb();
  const [row] = await db.select().from(businessWidgets).where(eq(businessWidgets.id, widgetId)).limit(1);
  return row ?? null;
}

export async function getBusinessWidgetByChatId(chatId: string): Promise<BusinessWidgetRow | null> {
  const db = getDb();
  const [row] = await db.select().from(businessWidgets).where(eq(businessWidgets.chatId, chatId)).limit(1);
  return row ?? null;
}

export async function getBusinessWidgetByOwnerAndName(ownerUserId: string, name: string): Promise<BusinessWidgetRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(businessWidgets)
    .where(and(eq(businessWidgets.ownerUserId, ownerUserId), eq(businessWidgets.name, name)))
    .limit(1);
  return row ?? null;
}

export async function listBusinessWidgetsByOwner(ownerUserId: string): Promise<BusinessWidgetRow[]> {
  const db = getDb();
  return db.select().from(businessWidgets).where(eq(businessWidgets.ownerUserId, ownerUserId)).orderBy(desc(businessWidgets.updatedAt));
}

export async function createBusinessWidget(input: {
  ownerUserId: string;
  chatId: string;
  name: string;
  providerType: string;
  endpointUrl: string;
  contractUrl: string | null;
  apiKeyEnc: string;
  status?: string;
}): Promise<BusinessWidgetRow> {
  const db = getDb();
  const [row] = await db
    .insert(businessWidgets)
    .values({
      ownerUserId: input.ownerUserId,
      chatId: input.chatId,
      name: input.name,
      providerType: input.providerType,
      endpointUrl: input.endpointUrl,
      contractUrl: input.contractUrl,
      apiKeyEnc: input.apiKeyEnc,
      status: input.status ?? "active",
      lastAutoconfigAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  if (!row) throw new Error("Не удалось создать business widget");
  return row;
}

export async function updateBusinessWidget(widgetId: string, patch: Partial<{
  chatId: string;
  endpointUrl: string;
  contractUrl: string | null;
  apiKeyEnc: string;
  providerType: string;
  status: string;
  lastError: string | null;
}>): Promise<BusinessWidgetRow | null> {
  const db = getDb();
  const [row] = await db
    .update(businessWidgets)
    .set({
      ...patch,
      lastAutoconfigAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(businessWidgets.id, widgetId))
    .returning();
  return row ?? null;
}

export async function saveBusinessContractSnapshot(input: {
  widgetId: string;
  rawJson: string;
  normalizedDslJson: string;
  uiBlueprintJson: string;
}): Promise<void> {
  const db = getDb();
  const latest = await db
    .select({ version: businessContracts.version })
    .from(businessContracts)
    .where(eq(businessContracts.widgetId, input.widgetId))
    .orderBy(desc(businessContracts.version))
    .limit(1);
  const nextVersion = Number(latest[0]?.version ?? 0) + 1;
  await db.insert(businessContracts).values({
    widgetId: input.widgetId,
    rawJson: input.rawJson,
    normalizedDslJson: input.normalizedDslJson,
    uiBlueprintJson: input.uiBlueprintJson,
    version: nextVersion,
    updatedAt: new Date(),
  });
}

export async function replaceBusinessActions(widgetId: string, actions: ConstructorAction[]): Promise<void> {
  const db = getDb();
  await db.delete(businessActions).where(eq(businessActions.widgetId, widgetId));
  if (actions.length === 0) return;
  await db.insert(businessActions).values(
    actions.map((action, index) => ({
      widgetId,
      actionId: action.id,
      label: action.label,
      kind: action.kind,
      requestMethod: action.method,
      requestPath: action.path,
      inputSchemaJson: action.inputSchema ? JSON.stringify(action.inputSchema) : null,
      payloadJson: action.payload ? JSON.stringify(action.payload) : null,
      orderIndex: action.orderIndex ?? index,
      isActive: true,
      updatedAt: new Date(),
    })),
  );
}

export async function listBusinessActionsByChatId(chatId: string): Promise<BusinessActionRow[]> {
  const db = getDb();
  return db
    .select({ action: businessActions })
    .from(businessActions)
    .innerJoin(businessWidgets, eq(businessWidgets.id, businessActions.widgetId))
    .where(and(eq(businessWidgets.chatId, chatId), eq(businessActions.isActive, true)))
    .orderBy(asc(businessActions.orderIndex), asc(businessActions.createdAt))
    .then((rows) => rows.map((r) => r.action));
}

export async function getBusinessActionByChatAndActionId(chatId: string, actionId: string): Promise<BusinessActionRow | null> {
  const db = getDb();
  const [row] = await db
    .select({ action: businessActions })
    .from(businessActions)
    .innerJoin(businessWidgets, eq(businessWidgets.id, businessActions.widgetId))
    .where(and(eq(businessWidgets.chatId, chatId), eq(businessActions.actionId, actionId), eq(businessActions.isActive, true)))
    .limit(1);
  return row?.action ?? null;
}

export async function insertBusinessEvent(input: {
  widgetId: string;
  direction: "inbound" | "outbound";
  eventType: string;
  status?: string;
  idempotencyKey?: string | null;
  externalEventId?: string | null;
  payloadJson: string;
  nextAttemptAt?: Date | null;
}): Promise<BusinessEventRow> {
  const db = getDb();
  const [row] = await db
    .insert(businessEvents)
    .values({
      widgetId: input.widgetId,
      direction: input.direction,
      eventType: input.eventType,
      status: input.status ?? "pending",
      idempotencyKey: input.idempotencyKey ?? null,
      externalEventId: input.externalEventId ?? null,
      payloadJson: input.payloadJson,
      nextAttemptAt: input.nextAttemptAt ?? new Date(),
      updatedAt: new Date(),
    })
    .returning();
  if (!row) throw new Error("Не удалось создать событие business");
  return row;
}

export async function listDueOutboundEvents(limit = 20): Promise<Array<BusinessEventRow & { widget: BusinessWidgetRow }>> {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .select({
      event: businessEvents,
      widget: businessWidgets,
    })
    .from(businessEvents)
    .innerJoin(businessWidgets, eq(businessWidgets.id, businessEvents.widgetId))
    .where(
      and(
        eq(businessEvents.direction, "outbound"),
        or(eq(businessEvents.status, "pending"), eq(businessEvents.status, "retrying")),
        lte(businessEvents.nextAttemptAt, now),
      ),
    )
    .orderBy(asc(businessEvents.createdAt))
    .limit(Math.max(1, Math.min(limit, 100)));
  return rows.map((row) => ({ ...row.event, widget: row.widget }));
}

export async function markBusinessEventDelivered(eventId: string, responseJson: string): Promise<void> {
  const db = getDb();
  await db
    .update(businessEvents)
    .set({
      status: "delivered",
      responseJson,
      updatedAt: new Date(),
    })
    .where(eq(businessEvents.id, eventId));
}

export async function markBusinessEventRetry(eventId: string, attemptCount: number, nextAttemptAt: Date, errorMessage: string): Promise<void> {
  const db = getDb();
  await db
    .update(businessEvents)
    .set({
      status: "retrying",
      attemptCount,
      nextAttemptAt,
      lastError: errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(businessEvents.id, eventId));
}

export async function markBusinessEventFailed(eventId: string, attemptCount: number, errorMessage: string): Promise<void> {
  const db = getDb();
  await db
    .update(businessEvents)
    .set({
      status: "failed",
      attemptCount,
      lastError: errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(businessEvents.id, eventId));
}
