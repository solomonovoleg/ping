import { randomUUID } from "crypto";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { helpPages } from "@shared/schema";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class HelpPagesError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function assertValidSlug(slug: string): string {
  const s = slug.trim().toLowerCase();
  if (!s || s.length > 64 || !SLUG_RE.test(s)) {
    throw new HelpPagesError(400, "Некорректный slug (латиница, цифры, дефис)");
  }
  return s;
}

export async function listHelpPagesPublic(): Promise<{ slug: string; title: string; sortOrder: number }[]> {
  const db = getDb();
  const rows = await db
    .select({ slug: helpPages.slug, title: helpPages.title, sortOrder: helpPages.sortOrder })
    .from(helpPages)
    .orderBy(asc(helpPages.sortOrder), asc(helpPages.slug));
  return rows;
}

export async function getHelpPageBySlug(
  slug: string
): Promise<{ slug: string; title: string; body: string; updatedAt: string } | null> {
  const s = assertValidSlug(slug);
  const db = getDb();
  const [row] = await db.select().from(helpPages).where(eq(helpPages.slug, s)).limit(1);
  if (!row) return null;
  return {
    slug: row.slug,
    title: row.title,
    body: row.body ?? "",
    updatedAt: (row.updatedAt ?? row.createdAt ?? new Date()).toISOString(),
  };
}

export type AdminHelpPageRow = {
  id: string;
  slug: string;
  title: string;
  body: string;
  sortOrder: number;
  updatedAt: string;
};

export async function listHelpPagesAdmin(): Promise<AdminHelpPageRow[]> {
  const db = getDb();
  const rows = await db.select().from(helpPages).orderBy(asc(helpPages.sortOrder), asc(helpPages.slug));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    body: r.body ?? "",
    sortOrder: r.sortOrder,
    updatedAt: (r.updatedAt ?? r.createdAt ?? new Date()).toISOString(),
  }));
}

export async function createHelpPage(input: {
  slug: string;
  title: string;
  body?: string;
  sortOrder?: number;
}): Promise<AdminHelpPageRow> {
  const slug = assertValidSlug(input.slug);
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 500) : "";
  if (!title) throw new HelpPagesError(400, "Укажите заголовок");
  const body = typeof input.body === "string" ? input.body : "";
  const sortOrder =
    typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
      ? Math.min(10_000, Math.max(0, Math.floor(input.sortOrder)))
      : 0;
  const db = getDb();
  const id = randomUUID();
  try {
    await db.insert(helpPages).values({
      id,
      slug,
      title,
      body,
      sortOrder,
      updatedAt: new Date(),
    });
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
    if (msg === "23505") throw new HelpPagesError(409, "Страница с таким slug уже есть");
    throw e;
  }
  const created = await getHelpPageBySlug(slug);
  if (!created) throw new HelpPagesError(500, "Не удалось создать страницу");
  return { id, ...created, sortOrder };
}

export async function updateHelpPageBySlug(
  slug: string,
  patch: { title?: unknown; body?: unknown; sortOrder?: unknown }
): Promise<AdminHelpPageRow | null> {
  const s = assertValidSlug(slug);
  const db = getDb();
  const [existing] = await db.select({ id: helpPages.id }).from(helpPages).where(eq(helpPages.slug, s)).limit(1);
  if (!existing) return null;

  const clean: { title?: string; body?: string; sortOrder?: number; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (patch.title !== undefined) {
    const t = typeof patch.title === "string" ? patch.title.trim().slice(0, 500) : "";
    if (!t) throw new HelpPagesError(400, "Заголовок не может быть пустым");
    clean.title = t;
  }
  if (patch.body !== undefined) {
    clean.body = typeof patch.body === "string" ? patch.body : "";
  }
  if (patch.sortOrder !== undefined) {
    const n = Number(patch.sortOrder);
    if (!Number.isFinite(n)) throw new HelpPagesError(400, "sortOrder: число");
    clean.sortOrder = Math.min(10_000, Math.max(0, Math.floor(n)));
  }

  if (Object.keys(clean).length <= 1) {
    const [row] = await db.select().from(helpPages).where(eq(helpPages.slug, s)).limit(1);
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      body: row.body ?? "",
      sortOrder: row.sortOrder,
      updatedAt: (row.updatedAt ?? new Date()).toISOString(),
    };
  }

  await db.update(helpPages).set(clean).where(eq(helpPages.slug, s));
  const [row] = await db.select().from(helpPages).where(eq(helpPages.slug, s)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    body: row.body ?? "",
    sortOrder: row.sortOrder,
    updatedAt: (row.updatedAt ?? new Date()).toISOString(),
  };
}
