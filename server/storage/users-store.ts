import type { User, InsertUser, UpdateProfile } from "@shared/schema";
import { randomUUID } from "crypto";

const INITIAL_PUBLIC_ID = 100;

export interface UsersStore {
  get(id: string): User | undefined;
  getByPhone(phone: string): User | undefined;
  getByPublicId(publicId: number): User | undefined;
  search(query: string): User[];
  getNextPublicId(): number;
  create(data: InsertUser): User;
  updateProfile(userId: string, data: UpdateProfile): void;
  getAdminStats(): { total: number; blocked: number; deleted: number; registeredToday: number };
  listForAdmin(opts: { limit: number; offset: number; includeDeleted?: boolean; search?: string }): { users: User[]; total: number };
  setBlocked(userId: string, blocked: boolean, opts?: { bannedBy: string; banReason?: string }): void;
  setDeleted(userId: string, deleted: boolean): void;
  setPlatformRole(userId: string, role: string): void;
  setLastSeen(userId: string, at: Date): void;
  setFcmToken(userId: string, token: string | null): void;
  listAdmins(): User[];
  countReferralsByInviter(inviterUserId: string): number;
  listInvitedBy(inviterUserId: string): User[];
}

export function createUsersStore(): UsersStore {
  const users = new Map<string, User>();
  let nextPublicId = INITIAL_PUBLIC_ID;

  function matchesQuery(u: User, q: string): boolean {
    const lower = q.toLowerCase().trim();
    if (!lower) return false;
    if (u.phone.toLowerCase().includes(lower) || u.phone.replace(/\D/g, "").includes(lower.replace(/\D/g, ""))) return true;
    if (String(u.publicId) === lower || String(u.publicId).startsWith(lower)) return true;
    const name = [u.displayName, u.surname].filter(Boolean).join(" ").toLowerCase();
    if (name && name.includes(lower)) return true;
    return false;
  }

  return {
    get(id: string) {
      return users.get(id);
    },
    getByPhone(phone: string) {
      return Array.from(users.values()).find((u) => u.phone === phone);
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
      } as User;
      users.set(id, user);
      return user;
    },
    updateProfile(userId: string, data: UpdateProfile) {
      const user = users.get(userId);
      if (!user) return;
      if (data.displayName !== undefined) (user as User).displayName = data.displayName;
      if (data.surname !== undefined) (user as User).surname = data.surname;
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
      if ((data as { referralLimit?: number | null }).referralLimit !== undefined) {
        const v = (data as { referralLimit?: number | null }).referralLimit;
        (user as User).referralLimit = v == null ? null : v;
      }
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
        const q = opts.search.trim().toLowerCase();
        list = list.filter((u) => {
          const name = [u.displayName, u.surname].filter(Boolean).join(" ").toLowerCase();
          return (
            name.includes(q) ||
            u.phone.toLowerCase().includes(q) ||
            String(u.publicId).includes(q)
          );
        });
      }
      const total = list.length;
      list.sort((a, b) => new Date((b as User).createdAt!).getTime() - new Date((a as User).createdAt!).getTime());
      const usersPage = list.slice(opts.offset, opts.offset + opts.limit);
      return { users: usersPage, total };
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
  };
}
