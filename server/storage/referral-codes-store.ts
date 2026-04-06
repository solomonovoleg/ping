import { randomUUID } from "crypto";

export interface ReferralCodeRow {
  id: string;
  code: string;
  inviterUserId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  maxUses: number;
  useCount: number;
  bypassInviterLimit: boolean;
  adminNote?: string | null;
  edgeMoneyInviteBatchId?: string | null;
}

export interface ReferralCodesStore {
  create(
    inviterUserId: string,
    code: string,
    expiresAt: Date,
    opts?: {
      maxUses?: number;
      bypassInviterLimit?: boolean;
      adminNote?: string | null;
      edgeMoneyInviteBatchId?: string | null;
    },
  ): ReferralCodeRow;
  getByCode(code: string): ReferralCodeRow | undefined;
  consume(id: string): boolean;
  listActiveByInviter(inviterUserId: string): ReferralCodeRow[];
  deleteAllByInviter(inviterUserId: string): void;
}

function normalizeCode(code: string): string {
  return code.toLowerCase().trim().replace(/\s+/g, "-").replace(/-+/g, "-");
}

function rowIsUsable(r: ReferralCodeRow, now: Date): boolean {
  if (r.expiresAt <= now) return false;
  if (r.maxUses === 1) return r.usedAt == null;
  if (r.maxUses === -1) return true;
  if (r.maxUses > 1) return r.useCount < r.maxUses;
  return false;
}

export function createReferralCodesStore(): ReferralCodesStore {
  const byId = new Map<string, ReferralCodeRow>();
  const byCode = new Map<string, ReferralCodeRow>();

  return {
    create(
      inviterUserId: string,
      code: string,
      expiresAt: Date,
      opts?: {
        maxUses?: number;
        bypassInviterLimit?: boolean;
        adminNote?: string | null;
        edgeMoneyInviteBatchId?: string | null;
      },
    ) {
      let maxUses = opts?.maxUses ?? 1;
      if (maxUses === 0 || maxUses < -1) maxUses = 1;
      if (maxUses > 10_000) maxUses = 10_000;
      const id = randomUUID();
      const noteRaw = opts?.adminNote;
      const adminNote =
        typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim() : null;
      const batchRaw = opts?.edgeMoneyInviteBatchId;
      const edgeMoneyInviteBatchId =
        typeof batchRaw === "string" && batchRaw.trim() ? batchRaw.trim() : null;
      const row: ReferralCodeRow = {
        id,
        code,
        inviterUserId,
        expiresAt,
        usedAt: null,
        createdAt: new Date(),
        maxUses: maxUses === -1 || maxUses > 1 ? maxUses : 1,
        useCount: 0,
        bypassInviterLimit: opts?.bypassInviterLimit === true,
        adminNote,
        edgeMoneyInviteBatchId,
      };
      byId.set(id, row);
      byCode.set(normalizeCode(code), row);
      return row;
    },
    getByCode(code: string) {
      const row = byCode.get(normalizeCode(code));
      const now = new Date();
      if (!row || !rowIsUsable(row, now)) return undefined;
      return row;
    },
    consume(id: string) {
      const row = byId.get(id);
      const now = new Date();
      if (!row || !rowIsUsable(row, now)) return false;
      row.useCount += 1;
      if (row.maxUses === 1 || (row.maxUses > 1 && row.useCount >= row.maxUses)) {
        row.usedAt = new Date();
        byCode.delete(normalizeCode(row.code));
      }
      return true;
    },
    listActiveByInviter(inviterUserId: string) {
      const now = new Date();
      return Array.from(byId.values()).filter((r) => r.inviterUserId === inviterUserId && rowIsUsable(r, now));
    },
    deleteAllByInviter(inviterUserId: string) {
      for (const [id, row] of [...byId.entries()]) {
        if (row.inviterUserId !== inviterUserId) continue;
        byId.delete(id);
        byCode.delete(normalizeCode(row.code));
      }
    },
  };
}
