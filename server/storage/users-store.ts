import type { User, InsertUser, UpdateProfile } from "@shared/schema";
import { randomUUID } from "crypto";
import { normalizePhone, normalizedPhonesFromSearchQuery } from "../auth/phone";
import { isPhoneAtRestEnabled, phoneLookupHash } from "../auth/phone-at-rest";
import { STORAGE_INITIAL_PUBLIC_ID } from "./storage-constants";

export interface UsersStore {
  get(id: string): User | undefined;
  getByPhone(phone: string): User | undefined;
  getByPublicId(publicId: number): User | undefined;
  search(query: string): User[];
  getNextPublicId(): number;
  create(data: InsertUser): User;
  setPasswordHash(userId: string, passwordHash: string): boolean;
  updateProfile(userId: string, data: UpdateProfile): void;
  adminSetPublicId(
    userId: string,
    newPublicId: number,
  ): { ok: true; user: User } | { ok: false; reason: "not_found" | "taken" | "invalid" };
  getAdminStats(): { total: number; blocked: number; deleted: number; registeredToday: number };
  listForAdmin(opts: {
    limit: number;
    offset: number;
    includeDeleted?: boolean;
    search?: string;
    sort?: "createdAt" | "referrals" | "invitedBy";
    sortDir?: "asc" | "desc";
  }): { users: User[]; total: number };
  /** Все неудалённые пользователи (только mem-store, для внутренних запросов без пагинации). */
  listActiveUsersFlat(): User[];
  /** Studio user (медиа-студия): пометить после createUser */
  applyStudioSyntheticFlags(userId: string, createdByAdminId: string): User | undefined;
  /** Список studio users для админки */
  listStudioSyntheticForAdmin(opts: { limit: number; offset: number }): { users: User[]; total: number };
  /** Удалить пользователя из памяти; обнулить у других invited_by / banned_by, указывающие на него. */
  deletePermanently(userId: string): boolean;
  setBlocked(userId: string, blocked: boolean, opts?: { bannedBy: string; banReason?: string }): void;
  setDeleted(userId: string, deleted: boolean): void;
  setPlatformRole(userId: string, role: string): void;
  setLastSeen(userId: string, at: Date): void;
  setFcmToken(userId: string, token: string | null): void;
  setIosVoipToken(userId: string, token: string | null): void;
  listAdmins(): User[];
  countReferralsByInviter(inviterUserId: string): number;
  listInvitedBy(inviterUserId: string): User[];
  /** Публичные поля для списка «кем приглашён» в админке */
  getPublicBriefByIds(
    ids: string[],
  ): Record<string, { publicId: number; displayName: string | null; surname: string | null }>;
  getRegistrationsByDay(days: number): { day: string; count: number }[];
}

export function createUsersStore(): UsersStore {
  const users = new Map<string, User>();
  let nextPublicId = STORAGE_INITIAL_PUBLIC_ID;

  function matchesQuery(u: User, q: string): boolean {
    const trimmed = q.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    for (const normalizedQ of normalizedPhonesFromSearchQuery(trimmed)) {
      if (u.phone && u.phone === normalizedQ) return true;
      if (isPhoneAtRestEnabled() && u.phoneLookupHash) {
        try {
          if (phoneLookupHash(normalizedQ) === u.phoneLookupHash) return true;
        } catch {
          /* */
        }
      }
    }
    if (/^\d+$/u.test(trimmed) && u.publicId === parseInt(trimmed, 10)) return true;
    const nickNeedle = trimmed.replace(/^@+/u, "").toLowerCase();
    if (nickNeedle && u.nickname && u.nickname.toLowerCase().includes(nickNeedle)) return true;
    const name = [u.displayName, u.surname].filter(Boolean).join(" ").toLowerCase();
    if (name && name.includes(lower)) return true;
    return false;
  }

  return {
    get(id: string) {
      return users.get(id);
    },
    getByPhone(phone: string) {
      if (phone === "admin") return Array.from(users.values()).find((u) => u.phone === "admin");
      const normalized = normalizePhone(phone);
      if (!normalized) return undefined;
      for (const u of users.values()) {
        if (u.phone === normalized) return u;
        if (isPhoneAtRestEnabled() && u.phoneLookupHash) {
          try {
            if (phoneLookupHash(normalized) === u.phoneLookupHash) return u;
          } catch {
            /* */
          }
        }
      }
      return undefined;
    },
    getByPublicId(publicId: number) {
      return Array.from(users.values()).find((u) => u.publicId === publicId);
    },
    search(query: string) {
      const q = query.trim();
      if (!q) return [];
      return Array.from(users.values()).filter((u) => matchesQuery(u, q));
    },
    getNextPublicId() {
      const id = nextPublicId;
      nextPublicId += 1;
      return id;
    },
    create(data: InsertUser) {
      const id = randomUUID();
      const user: User = {
        ...data,
        id,
        platformRole: "user",
        isBlocked: false,
        bannedAt: null,
        bannedBy: null,
        banReason: null,
        deletedAt: null,
        createdAt: new Date(),
        boardApiHubPrimeCode: null,
        isStudioSynthetic: false,
        studioCreatedByAdminId: null,
        iosVoipToken: null,
      } as User;
      users.set(id, user);
      return user;
    },
    setPasswordHash(userId: string, passwordHash: string) {
      const user = users.get(userId);
      if (!user) return false;
      (user as User).password = passwordHash;
      return true;
    },
    applyStudioSyntheticFlags(userId: string, createdByAdminId: string) {
      const user = users.get(userId);
      if (!user) return undefined;
      (user as User).isStudioSynthetic = true;
      (user as User).studioCreatedByAdminId = createdByAdminId;
      return user;
    },
    listStudioSyntheticForAdmin(opts: { limit: number; offset: number }) {
      const all = Array.from(users.values()).filter((u) => u.isStudioSynthetic === true);
      all.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      const total = all.length;
      const slice = all.slice(opts.offset, opts.offset + opts.limit);
      return { users: slice, total };
    },
    updateProfile(userId: string, data: UpdateProfile) {
      const user = users.get(userId);
      if (!user) return;
      if (data.displayName !== undefined) (user as User).displayName = data.displayName;
      if (data.surname !== undefined) (user as User).surname = data.surname;
      if (data.nickname !== undefined) (user as User).nickname = data.nickname;
      if (data.gender !== undefined) (user as User).gender = data.gender;
      if (data.birthDate !== undefined) (user as User).birthDate = data.birthDate;
      if (data.avatarUrl !== undefined) (user as User).avatarUrl = data.avatarUrl;
      if (data.hideFromSearch !== undefined) (user as User).hideFromSearch = data.hideFromSearch;
      if (data.bio !== undefined) (user as User).bio = data.bio;
      if (data.coverUrl !== undefined) (user as User).coverUrl = data.coverUrl;
      if (data.showCover !== undefined) (user as User).showCover = data.showCover;
      if (data.profileLink !== undefined) (user as User).profileLink = data.profileLink;
      if (data.pushEnabled !== undefined) (user as User).pushEnabled = data.pushEnabled;
      if (data.vibeEnabled !== undefined) (user as User).vibeEnabled = data.vibeEnabled;
      if (data.vibeShareWithPartner !== undefined) (user as User).vibeShareWithPartner = data.vibeShareWithPartner;
      if (data.dmPolicy !== undefined) (user as User).dmPolicy = data.dmPolicy;
      if (data.groupAddMePolicy !== undefined) (user as User).groupAddMePolicy = data.groupAddMePolicy;
      if ((data as { referralLimit?: number | null }).referralLimit !== undefined) {
        const v = (data as { referralLimit?: number | null }).referralLimit;
        (user as User).referralLimit = v == null ? null : v;
      }
      if (data.boardApiHubPrimeCode !== undefined) {
        const v = data.boardApiHubPrimeCode;
        (user as User).boardApiHubPrimeCode =
          v == null || (typeof v === "string" && v.trim() === "") ? null : String(v).trim().slice(0, 64);
      }
    },
    adminSetPublicId(userId: string, newPublicId: number) {
      if (!Number.isInteger(newPublicId) || newPublicId < 1 || newPublicId > 2_147_483_647) {
        return { ok: false as const, reason: "invalid" as const };
      }
      const user = users.get(userId);
      if (!user) return { ok: false as const, reason: "not_found" as const };
      if (user.publicId === newPublicId) return { ok: true as const, user };
      const taken = Array.from(users.values()).some((u) => u.publicId === newPublicId && u.id !== userId);
      if (taken) return { ok: false as const, reason: "taken" as const };
      (user as User).publicId = newPublicId;
      return { ok: true as const, user };
    },
    getAdminStats() {
      const all = Array.from(users.values());
      const notDeleted = all.filter((u) => !(u as User).deletedAt);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const registeredToday = notDeleted.filter((u) => new Date((u as User).createdAt!) >= todayStart).length;
      return {
        total: notDeleted.length,
        blocked: notDeleted.filter((u) => (u as User).isBlocked).length,
        deleted: all.filter((u) => (u as User).deletedAt).length,
        registeredToday,
      };
    },
    listForAdmin(opts) {
      let list = Array.from(users.values());
      if (!opts.includeDeleted) list = list.filter((u) => !(u as User).deletedAt);
      if (opts.search?.trim()) {
        const raw = opts.search.trim();
        const q = raw.toLowerCase();
        list = list.filter((u) => {
          const name = [u.displayName, u.surname].filter(Boolean).join(" ").toLowerCase();
          const nick = (u.nickname ?? "").toLowerCase();
          if (name.includes(q) || nick.includes(q)) return true;
          if (/^\d+$/u.test(raw) && String(u.publicId).includes(raw)) return true;
          for (const np of normalizedPhonesFromSearchQuery(raw)) {
            if (u.phone === np) return true;
            if (isPhoneAtRestEnabled() && u.phoneLookupHash) {
              try {
                if (phoneLookupHash(np) === u.phoneLookupHash) return true;
              } catch {
                /* */
              }
            }
          }
          return false;
        });
      }
      const total = list.length;
      const sort = opts.sort ?? "createdAt";
      const sortDir = opts.sortDir === "asc" ? "asc" : "desc";
      const refCount = (uid: string) =>
        Array.from(users.values()).filter((u) => (u as User).invitedById === uid).length;
      const cmp = (a: User, b: User): number => {
        let primary = 0;
        if (sort === "referrals") {
          primary = refCount(a.id) - refCount(b.id);
        } else if (sort === "invitedBy") {
          const ai = a.invitedById ?? "";
          const bi = b.invitedById ?? "";
          primary = ai.localeCompare(bi);
        } else {
          primary =
            new Date((a as User).createdAt!).getTime() - new Date((b as User).createdAt!).getTime();
        }
        if (primary !== 0) return sortDir === "asc" ? primary : -primary;
        return new Date((b as User).createdAt!).getTime() - new Date((a as User).createdAt!).getTime();
      };
      list.sort(cmp);
      const usersPage = list.slice(opts.offset, opts.offset + opts.limit);
      return { users: usersPage, total };
    },
    listActiveUsersFlat() {
      return Array.from(users.values()).filter((u) => !(u as User).deletedAt);
    },
    deletePermanently(userId: string) {
      if (!users.has(userId)) return false;
      users.delete(userId);
      for (const u of users.values()) {
        if ((u as User).invitedById === userId) (u as User).invitedById = null;
        if ((u as User).bannedBy === userId) {
          (u as User).bannedBy = null;
          (u as User).bannedAt = null;
          (u as User).banReason = null;
          (u as User).isBlocked = false;
        }
      }
      return true;
    },
    setBlocked(userId: string, blocked: boolean, opts?: { bannedBy: string; banReason?: string }) {
      const u = users.get(userId);
      if (!u) return;
      (u as User).isBlocked = blocked;
      if (blocked && opts) {
        (u as User).bannedAt = new Date();
        (u as User).bannedBy = opts.bannedBy ?? null;
        (u as User).banReason = opts.banReason ?? null;
      } else if (!blocked) {
        (u as User).bannedAt = null;
        (u as User).bannedBy = null;
        (u as User).banReason = null;
      }
    },
    setDeleted(userId: string, deleted: boolean) {
      const u = users.get(userId);
      if (u) (u as User).deletedAt = deleted ? new Date() : null;
    },
    setPlatformRole(userId: string, role: string) {
      const u = users.get(userId);
      if (u) (u as User).platformRole = role as User["platformRole"];
    },
    setLastSeen(userId: string, at: Date) {
      const u = users.get(userId);
      if (u) (u as User).lastSeenAt = at;
    },
    setFcmToken(userId: string, token: string | null) {
      const u = users.get(userId);
      if (u) (u as User).fcmToken = token;
    },
    setIosVoipToken(userId: string, token: string | null) {
      const u = users.get(userId);
      if (u) (u as User).iosVoipToken = token;
    },
    listAdmins() {
      return Array.from(users.values()).filter(
        (u) => (u as User).platformRole && (u as User).platformRole !== "user"
      ) as User[];
    },
    countReferralsByInviter(inviterUserId: string) {
      return Array.from(users.values()).filter(
        (u) => (u as User).invitedById === inviterUserId
      ).length;
    },
    listInvitedBy(inviterUserId: string) {
      return Array.from(users.values())
        .filter((u) => (u as User).invitedById === inviterUserId)
        .sort((a, b) => new Date((b as User).createdAt!).getTime() - new Date((a as User).createdAt!).getTime());
    },
    getPublicBriefByIds(ids: string[]) {
      const out: Record<string, { publicId: number; displayName: string | null; surname: string | null }> = {};
      const seen = new Set<string>();
      for (const id of ids) {
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const u = users.get(id) as User | undefined;
        if (!u) continue;
        out[id] = {
          publicId: u.publicId,
          displayName: u.displayName ?? null,
          surname: u.surname ?? null,
        };
      }
      return out;
    },
    getRegistrationsByDay(days: number) {
      const safeDays = Math.min(Math.max(1, Math.floor(days)), 90);
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      start.setUTCDate(start.getUTCDate() - (safeDays - 1));
      const map = new Map<string, number>();
      for (const u of users.values()) {
        if ((u as User).deletedAt) continue;
        const c = (u as User).createdAt;
        if (!c || new Date(c) < start) continue;
        const d = new Date(c);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      const out: { day: string; count: number }[] = [];
      for (let i = 0; i < safeDays; i++) {
        const d = new Date(start);
        d.setUTCDate(start.getUTCDate() + i);
        const key = d.toISOString().slice(0, 10);
        out.push({ day: key, count: map.get(key) ?? 0 });
      }
      return out;
    },
  };
}
