import { integer, jsonb, pgTable, smallint, text, timestamp } from "drizzle-orm/pg-core";

/** Один глобальный снапшот порядка постов в ленте (id всегда 1). */
export const feedGlobalSnapshot = pgTable("feed_global_snapshot", {
  id: smallint("id").primaryKey().default(1),
  computedAt: timestamp("computed_at", { withTimezone: true, mode: "date" }).notNull(),
  algoMode: text("algo_mode").notNull(),
  candidateCount: integer("candidate_count").notNull(),
  postIds: jsonb("post_ids").notNull().$type<string[]>(),
});
