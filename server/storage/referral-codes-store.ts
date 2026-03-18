import { randomUUID } from "crypto";

export interface ReferralCodeRow {
  id: string;
  code: string;
  inviterUserId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface ReferralCodesStore {
  create(inviterUserId: string, code: string, expiresAt: Date): ReferralCodeRow;
  getByCode(code: string): ReferralCodeRow | undefined;
  markUsed(id: string): void;
  listActiveByInviter(inviterUserId: string): ReferralCodeRow[];
}

function normalizeCode(code: string): string {
  return code.toLowerCase().trim().replace(/\s+/g, "-").replace(/-+/g, "-");
}

export function createReferralCodesStore(): ReferralCodesStore {
  const byId = new Map<string, ReferralCodeRow>();
  const byCode = new Map<string, ReferralCodeRow>();

  return {
    create(inviterUserId: string, code: string, expiresAt: Date) {
      const id = randomUUID();
      const row: ReferralCodeRow = {
        id,
        code,
        inviterUserId,
        expiresAt,
        usedAt: null,
        createdAt: new Date(),
      };
      byId.set(id, row);
      byCode.set(normalizeCode(code), row);
      return row;
    },
    getByCode(code: string) {
      const row = byCode.get(normalizeCode(code));
      if (!row || row.usedAt || row.expiresAt <= new Date()) return undefined;
      return row;
    },
    markUsed(id: string) {
      const row = byId.get(id);
      if (row) {
        row.usedAt = new Date();
        byCode.delete(normalizeCode(row.code));
      }
    },
    listActiveByInviter(inviterUserId: string) {
      const now = new Date();
      return Array.from(byId.values()).filter(
        (r) => r.inviterUserId === inviterUserId && !r.usedAt && r.expiresAt > now
      );
    },
  };
}
