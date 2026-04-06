import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateWithYearLocal } from "@/lib/timezone";
import {
  adminGetStats,
  adminGetUsers,
  adminBlockUser,
  adminUnblockUser,
  adminDeleteUser,
  adminLogout,
  adminGetFeedAlgorithm,
  adminUpdateFeedAlgorithm,
  adminCreateReferralCode,
  adminGetReferralCodes,
  type AdminStats,
  type AdminUser,
  type FeedAlgoConfig,
  type AdminReferralCode,
} from "./api";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Search, Ban, CheckCircle, Trash2, Copy, Ticket } from "lucide-react";

const PAGE_SIZE = 20;

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [feedConfig, setFeedConfig] = useState<FeedAlgoConfig | null>(null);
  const [feedSaving, setFeedSaving] = useState(false);
  const [referralCodes, setReferralCodes] = useState<AdminReferralCode[]>([]);
  const [creatingCode, setCreatingCode] = useState(false);
  const { toast } = useToast();

  const loadStats = useCallback(async () => {
    try {
      const s = await adminGetStats();
      setStats(s);
    } catch {
      toast({ title: "Ошибка загрузки статистики", variant: "destructive" });
    }
  }, [toast]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { users: list, total: t } = await adminGetUsers({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        deleted: showDeleted,
        search: search.trim() || undefined,
      });
      setUsers(list);
      setTotal(t);
    } catch {
      toast({ title: "Ошибка загрузки пользователей", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [page, showDeleted, search, toast]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    adminGetFeedAlgorithm()
      .then(setFeedConfig)
      .catch(() => toast({ title: "Не удалось загрузить настройки ленты", variant: "destructive" }));
  }, [toast]);

  const loadReferralCodes = useCallback(async () => {
    try {
      const { codes } = await adminGetReferralCodes();
      setReferralCodes(codes);
    } catch {
      setReferralCodes([]);
    }
  }, []);

  useEffect(() => {
    loadReferralCodes();
  }, [loadReferralCodes]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreateInviteCode = async () => {
    setCreatingCode(true);
    try {
      const created = await adminCreateReferralCode({ expiresInHours: 7 * 24 });
      setReferralCodes((prev) => [{ ...created, expiresInHours: created.expiresInHours }, ...prev]);
      toast({ title: "Код создан", description: created.code });
      await navigator.clipboard.writeText(created.code);
      toast({ title: "Код скопирован в буфер" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Ошибка создания кода", variant: "destructive" });
    } finally {
      setCreatingCode(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(
      () => toast({ title: "Код скопирован" }),
      () => toast({ title: "Не удалось скопировать", variant: "destructive" })
    );
  };

  const handleBlock = async (u: AdminUser) => {
    setActionId(u.id);
    try {
      await adminBlockUser(u.id);
      toast({ title: "Пользователь заблокирован" });
      loadStats();
      loadUsers();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const handleUnblock = async (u: AdminUser) => {
    setActionId(u.id);
    try {
      await adminUnblockUser(u.id);
      toast({ title: "Пользователь разблокирован" });
      loadStats();
      loadUsers();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (u: AdminUser) => {
    if (!confirm(`Удалить пользователя ${displayName(u)}?`)) return;
    setActionId(u.id);
    try {
      await adminDeleteUser(u.id);
      toast({ title: "Пользователь удалён" });
      loadStats();
      loadUsers();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    window.location.reload();
  };

  const displayName = (u: AdminUser) =>
    [u.displayName, u.surname].filter(Boolean).join(" ") || `ID ${u.publicId}`;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <header className="sticky top-0 z-10 border-b border-slate-700 bg-slate-800/95 backdrop-blur px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">PING — Админ</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-300 hover:text-white">
          <LogOut className="w-4 h-4 mr-1" />
          Выйти
        </Button>
      </header>

      <main className="p-4 space-y-6">
        {feedConfig && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-100">Алгоритм ленты</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs text-slate-400">
                Режим
                <select
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-2 text-sm text-white"
                  value={feedConfig.mode}
                  onChange={(e) => setFeedConfig((prev) => prev ? { ...prev, mode: e.target.value as FeedAlgoConfig["mode"] } : prev)}
                >
                  <option value="strict_chrono">strict_chrono</option>
                  <option value="chrono_boost_v1">chrono_boost_v1</option>
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Окно буста (ч)
                <Input
                  type="number"
                  value={feedConfig.boostWindowHours}
                  onChange={(e) => setFeedConfig((prev) => prev ? { ...prev, boostWindowHours: Number(e.target.value) || 12 } : prev)}
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </label>
              <label className="text-xs text-slate-400">
                Реакция (+мин)
                <Input
                  type="number"
                  value={feedConfig.reactionBoostMinutes}
                  onChange={(e) => setFeedConfig((prev) => prev ? { ...prev, reactionBoostMinutes: Number(e.target.value) || 0 } : prev)}
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </label>
              <label className="text-xs text-slate-400">
                Комментарий (+мин)
                <Input
                  type="number"
                  value={feedConfig.commentBoostMinutes}
                  onChange={(e) => setFeedConfig((prev) => prev ? { ...prev, commentBoostMinutes: Number(e.target.value) || 0 } : prev)}
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </label>
              <label className="text-xs text-slate-400">
                Репост (+мин)
                <Input
                  type="number"
                  value={feedConfig.shareBoostMinutes}
                  onChange={(e) => setFeedConfig((prev) => prev ? { ...prev, shareBoostMinutes: Number(e.target.value) || 0 } : prev)}
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </label>
              <label className="text-xs text-slate-400">
                Новый аккаунт фактор (0..1)
                <Input
                  type="number"
                  step="0.1"
                  value={feedConfig.newAccountFactor}
                  onChange={(e) => setFeedConfig((prev) => prev ? { ...prev, newAccountFactor: Number(e.target.value) || 0 } : prev)}
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </label>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={feedSaving}
                onClick={async () => {
                  setFeedSaving(true);
                  try {
                    const next = await adminUpdateFeedAlgorithm(feedConfig);
                    setFeedConfig(next);
                    toast({ title: "Алгоритм ленты обновлён" });
                  } catch (e) {
                    toast({ title: e instanceof Error ? e.message : "Ошибка обновления", variant: "destructive" });
                  } finally {
                    setFeedSaving(false);
                  }
                }}
              >
                {feedSaving ? "Сохранение..." : "Сохранить алгоритм"}
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Ticket className="w-4 h-4" />
            Пригласительные коды
          </p>
          <p className="text-xs text-slate-400">
            Админ может создавать неограниченное количество кодов. Пользователи регистрируются по коду. Обычный пользователь — до 3 приглашений.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={creatingCode}
              onClick={handleCreateInviteCode}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {creatingCode ? "Создание…" : "Создать код"}
            </Button>
          </div>
          {referralCodes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">Активные коды (действуют 7 дней):</p>
              <ul className="space-y-1.5">
                {referralCodes.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 py-2 px-3 rounded-md bg-slate-800 border border-slate-600"
                  >
                    <code className="text-sm font-mono text-emerald-300 break-all">{c.code}</code>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-slate-500">
                        до {formatDateWithYearLocal(new Date(c.expiresAt))}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                        onClick={() => copyCode(c.code)}
                        aria-label="Скопировать код"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-slate-800 border border-slate-700 p-4">
              <p className="text-slate-400 text-xs uppercase">Всего</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="rounded-lg bg-slate-800 border border-slate-700 p-4">
              <p className="text-slate-400 text-xs uppercase">Заблокировано</p>
              <p className="text-2xl font-bold text-amber-400">{stats.blocked}</p>
            </div>
            <div className="rounded-lg bg-slate-800 border border-slate-700 p-4">
              <p className="text-slate-400 text-xs uppercase">Удалено</p>
              <p className="text-2xl font-bold text-red-400">{stats.deleted}</p>
            </div>
            <div className="rounded-lg bg-slate-800 border border-slate-700 p-4">
              <p className="text-slate-400 text-xs uppercase">За сегодня</p>
              <p className="text-2xl font-bold text-emerald-400">{stats.registeredToday}</p>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="p-3 flex flex-wrap items-center gap-2 border-b border-slate-700">
            <div className="relative flex-1 min-w-[200px] flex gap-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <Input
                placeholder="Поиск по имени, телефону, ID…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (setSearch(searchInput), setPage(0))}
                className="pl-8 bg-slate-800 border-slate-600 text-white"
              />
              <Button
                size="sm"
                variant="secondary"
                className="bg-slate-700 border-slate-600"
                onClick={() => { setSearch(searchInput); setPage(0); }}
              >
                Найти
              </Button>
            </div>
            <Button
              variant={showDeleted ? "default" : "outline"}
              size="sm"
              onClick={() => { setShowDeleted(!showDeleted); setPage(0); }}
              className="border-slate-600 text-slate-300"
            >
              {showDeleted ? "Скрыть удалённых" : "Показать удалённых"}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-slate-400">ID / Имя</TableHead>
                  <TableHead className="text-slate-400">Пол</TableHead>
                  <TableHead className="text-slate-400">Статус</TableHead>
                  <TableHead className="text-slate-400 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow className="border-slate-700">
                    <TableCell colSpan={4} className="text-slate-500 text-center py-8">
                      Загрузка…
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow className="border-slate-700">
                    <TableCell colSpan={4} className="text-slate-500 text-center py-8">
                      Нет пользователей
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id} className="border-slate-700 hover:bg-slate-800/50">
                      <TableCell>
                        <span className="font-mono text-slate-500 text-xs">{u.publicId}</span>
                        <br />
                        {displayName(u)}
                      </TableCell>
                      <TableCell className="text-slate-400">{u.gender ?? "—"}</TableCell>
                      <TableCell>
                        {u.deletedAt ? (
                          <span className="text-red-400">Удалён</span>
                        ) : u.isBlocked ? (
                          <span className="text-amber-400">Заблокирован</span>
                        ) : (
                          <span className="text-emerald-400">Активен</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!u.deletedAt && (
                            u.isBlocked ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-slate-600 text-emerald-400"
                                disabled={actionId === u.id}
                                onClick={() => handleUnblock(u)}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-slate-600 text-amber-400"
                                disabled={actionId === u.id}
                                onClick={() => handleBlock(u)}
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            )
                          )}
                          {!u.deletedAt && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-slate-600 text-red-400"
                              disabled={actionId === u.id}
                              onClick={() => handleDelete(u)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {total > PAGE_SIZE && (
            <div className="p-3 border-t border-slate-700 flex items-center justify-between text-sm text-slate-400">
              <span>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} из {total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="border-slate-600"
                >
                  Назад
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(page + 1) * PAGE_SIZE >= total}
                  onClick={() => setPage((p) => p + 1)}
                  className="border-slate-600"
                >
                  Вперёд
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
