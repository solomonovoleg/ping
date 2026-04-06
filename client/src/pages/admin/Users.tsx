import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  AdminPageHeader,
  AdminPanelCard,
  adminDialogSurfaceClass,
  adminPageStackClass,
  useAdminShellUser,
} from "@/features/admin-shell";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  fetchAdminUsers,
  fetchAdminUserSignupInsight,
  banUser,
  unbanUser,
  deleteUser,
  banAndPurgeUser,
  updateAdminUser,
  bulkBanUsers,
  bulkDeleteUsers,
  type AdminUser,
  type AdminSignupRisk,
} from "@/lib/admin";
import {
  Ban,
  RotateCcw,
  Trash2,
  Search,
  Pencil,
  UserX,
  CircleAlert,
  Eye,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { BusinessStatusRequestsSection } from "./BusinessStatusRequestsSection";

const PAGE_SIZE = 20;

function SignupAttentionCell({ risk }: { risk?: AdminSignupRisk }) {
  const level = risk?.level ?? "none";
  if (level === "none") {
    return (
      <span
        className="inline-flex items-center justify-center min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]"
        title="По данным регистрации (устройство, IP+UA) признаков массовых аккаунтов нет. Эвристика, не гарантия."
      >
        <span
          className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)]"
          aria-label="Норма: без признаков массовой регистрации"
        />
      </span>
    );
  }
  const title = risk!.reasons.length > 0 ? risk!.reasons.join("\n") : "Совпадения по сигналам регистрации";
  if (level === "alert") {
    return (
      <Badge variant="destructive" className="gap-1 font-normal" title={title}>
        <span className="h-2 w-2 rounded-full bg-white/90 shrink-0" aria-hidden />
        Риск
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-amber-500/80 text-amber-800 dark:text-amber-400 font-normal"
      title={title}
    >
      <CircleAlert className="h-3 w-3 shrink-0" aria-hidden />
      Смотреть
    </Badge>
  );
}

type AdminUserSortKey = "createdAt" | "referrals" | "invitedBy";

function formatUserRegisteredAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function parsePublicIdForConfirm(value: string): number {
  const normalized = value.replace(/[^\d]/g, "").trim();
  if (!normalized) return NaN;
  return Number.parseInt(normalized, 10);
}

/** API может отдать publicId числом или строкой после JSON — приводим к одному виду для сверки. */
function normalizeAdminPublicId(raw: AdminUser["publicId"] | string | undefined): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (raw === undefined || raw === null) return NaN;
  return parsePublicIdForConfirm(String(raw));
}

function SortableTableHead({
  label,
  column,
  activeColumn,
  dir,
  onSort,
  className,
}: {
  label: string;
  column: AdminUserSortKey;
  activeColumn: AdminUserSortKey;
  dir: "asc" | "desc";
  onSort: (col: AdminUserSortKey) => void;
  className?: string;
}) {
  const active = activeColumn === column;
  return (
    <TableHead className={className}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 min-h-[var(--uix-touch-min)] -mx-1 px-1 rounded-md font-medium text-left hover:text-[hsl(210_20%_98%)]",
          active ? "text-[hsl(210_20%_98%)]" : "text-muted-foreground",
        )}
        onClick={() => onSort(column)}
      >
        <span>{label}</span>
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
        )}
      </button>
    </TableHead>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  const v = value != null && String(value).trim() !== "" ? String(value) : "—";
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1 border-b border-border/60 last:border-0">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="font-mono text-xs break-all">{v}</dd>
    </div>
  );
}

function RelatedUsersList({ title, users }: { title: string; users: AdminUser[] }) {
  if (users.length === 0) return null;
  return (
    <div className="mt-3">
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      <ul className="space-y-1.5 text-sm">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">ID {u.publicId}</span>
            <span>{[u.displayName, u.surname].filter(Boolean).join(" ") || "—"}</span>
            {u.isBlocked ? (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                бан
              </Badge>
            ) : null}
            {u.deletedAt ? (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                скрыт
              </Badge>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

type UserSignupInsightPayload = Awaited<ReturnType<typeof fetchAdminUserSignupInsight>>;

function UserSignupDetailBody({ payload }: { payload: UserSignupInsightPayload }) {
  const { user, related, hint } = payload;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-base">
          {[user.displayName, user.surname].filter(Boolean).join(" ") || "Без имени"} · публичный ID {user.publicId}
        </span>
        <SignupAttentionCell risk={user.signupRisk} />
      </div>
      {user.signupRisk && user.signupRisk.reasons.length > 0 ? (
        <ul className="text-muted-foreground list-disc pl-5 space-y-1">
          {user.signupRisk.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      ) : null}
      <div className="rounded-md border bg-muted/30 p-3 space-y-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Данные регистрации</p>
        <DetailRow label="Создан" value={user.createdAt ?? undefined} />
        <DetailRow label="IP" value={user.signupIp ?? undefined} />
        <DetailRow label="X-Forwarded-For" value={user.signupForwardedFor ?? undefined} />
        <DetailRow label="Device ID (cookie)" value={user.signupDeviceId ?? undefined} />
        <DetailRow label="User-Agent" value={user.signupUserAgent ?? undefined} />
        <DetailRow label="UA hash" value={user.signupUaHash ?? undefined} />
        <DetailRow label="Accept-Language" value={user.signupAcceptLanguage ?? undefined} />
        <DetailRow label="sec-ch-ua" value={user.signupSecChUa ?? undefined} />
        <DetailRow label="sec-ch-ua-mobile" value={user.signupSecChUaMobile ?? undefined} />
        <DetailRow label="sec-ch-ua-platform" value={user.signupSecChUaPlatform ?? undefined} />
        <DetailRow label="Referer" value={user.signupReferer ?? undefined} />
        <DetailRow label="Origin" value={user.signupOrigin ?? undefined} />
        <DetailRow label="Client signals hash" value={user.signupClientSignalsHash ?? undefined} />
        <DetailRow label="Client signals (JSON)" value={user.signupClientSignalsJson ?? undefined} />
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Связанные аккаунты</p>
        <RelatedUsersList title="То же устройство (cookie)" users={related.byDeviceId} />
        <RelatedUsersList title="Тот же IP" users={related.byIp} />
        <RelatedUsersList title="Тот же отпечаток UA" users={related.byUaHash} />
        <RelatedUsersList title="Те же client signals" users={related.byClientSignalsHash} />
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{hint}</p>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false);
  const [actionUser, setActionUser] = useState<AdminUser | null>(null);
  const [actionType, setActionType] = useState<"ban" | "unban" | "delete" | "purge" | null>(null);
  const [banReason, setBanReason] = useState("");
  const [purgeConfirmPublicId, setPurgeConfirmPublicId] = useState("");
  const [purgeReason, setPurgeReason] = useState("");
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editSurname, setEditSurname] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editReferralLimit, setEditReferralLimit] = useState<string>("");
  const [editBoardApiHubPrimeCode, setEditBoardApiHubPrimeCode] = useState("");
  const [editPublicId, setEditPublicId] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<AdminUserSortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkAction, setBulkAction] = useState<"ban" | "delete" | null>(null);
  const [bulkBanReason, setBulkBanReason] = useState("");
  const [bulkWorking, setBulkWorking] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const adminViewer = useAdminShellUser();
  const canEditPublicId = adminViewer?.platformRole === "admin" || adminViewer?.platformRole === "super_admin";

  const detailQuery = useQuery({
    queryKey: ["admin", "user-signup-insight", detailUserId],
    queryFn: () => fetchAdminUserSignupInsight(detailUserId!, { relatedLimit: 40 }),
    enabled: !!detailUserId,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "users", page, search, showDeleted, sortBy, sortDir],
    queryFn: () =>
      fetchAdminUsers({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        search: search || undefined,
        includeDeleted: showDeleted,
        sort: sortBy,
        sortDir,
      }),
  });

  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, showDeleted, sortBy, sortDir]);

  const handleSortColumn = (col: AdminUserSortKey) => {
    setPage(0);
    if (col === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir(col === "invitedBy" ? "asc" : "desc");
    }
  };

  const pageIds = data?.users.map((u) => u.id) ?? [];
  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length;
  const allOnPageSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;
  const someOnPageSelected = selectedOnPage > 0 && !allOnPageSelected;

  const toggleSelectAllPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const id of pageIds) next.add(id);
      } else {
        for (const id of pageIds) next.delete(id);
      }
      return next;
    });
  };

  const toggleRowSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runBulkAction = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0 || !bulkAction) return;
    setBulkWorking(true);
    try {
      if (bulkAction === "ban") {
        const { affected } = await bulkBanUsers(ids, bulkBanReason);
        toast({ title: "Заблокировано", description: `Обработано: ${affected}` });
      } else {
        const { affected } = await bulkDeleteUsers(ids);
        toast({ title: "Удалено (скрыто)", description: `Обработано: ${affected}` });
      }
      setBulkAction(null);
      setBulkBanReason("");
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard", "stats"] });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: e instanceof Error ? e.message : "Не удалось выполнить действие",
      });
    } finally {
      setBulkWorking(false);
    }
  };

  const runAction = async () => {
    if (!actionUser || !actionType) return;
    try {
      if (actionType === "ban") await banUser(actionUser.id, banReason);
      else if (actionType === "unban") await unbanUser(actionUser.id);
      else if (actionType === "delete") await deleteUser(actionUser.id);
      else if (actionType === "purge") {
        const n = parsePublicIdForConfirm(purgeConfirmPublicId);
        const expectedPublicId = Number(actionUser.publicId);
        if (!Number.isFinite(n) || !Number.isFinite(expectedPublicId) || n !== expectedPublicId) {
          toast({
            variant: "destructive",
            title: "Введите верный публичный ID",
            description: `Ожидается число ${expectedPublicId}`,
          });
          return;
        }
        await banAndPurgeUser(actionUser.id, n, purgeReason);
      }
      toast({
        title:
          actionType === "ban"
            ? "Заблокировано"
            : actionType === "unban"
              ? "Разблокировано"
              : actionType === "purge"
                ? "Пользователь удалён из системы"
                : "Удалено",
      });
      setActionUser(null);
      setActionType(null);
      setBanReason("");
      setPurgeConfirmPublicId("");
      setPurgeReason("");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "user-signup-insight"] });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: e instanceof Error ? e.message : "Не удалось выполнить действие",
      });
    }
  };

  const openBan = (u: AdminUser) => {
    setActionUser(u);
    setActionType("ban");
    setBanReason("");
  };
  const openUnban = (u: AdminUser) => {
    setActionUser(u);
    setActionType("unban");
  };
  const openDelete = (u: AdminUser) => {
    setActionUser(u);
    setActionType("delete");
  };
  const openPurge = (u: AdminUser) => {
    setActionUser(u);
    setActionType("purge");
    setPurgeConfirmPublicId(String(u.publicId));
    setPurgeReason("");
  };

  const openEdit = (u: AdminUser) => {
    setEditUser(u);
    setEditDisplayName(u.displayName ?? "");
    setEditSurname(u.surname ?? "");
    setEditStatus("");
    setEditCity("");
    setEditReferralLimit(u.referralLimit != null ? String(u.referralLimit) : "");
    setEditBoardApiHubPrimeCode(u.boardApiHubPrimeCode ?? "");
    setEditPublicId(String(u.publicId));
  };

  const runEditSave = async () => {
    if (!editUser) return;
    setEditLoading(true);
    try {
      const refLimit = editReferralLimit.trim();
      const payload: Parameters<typeof updateAdminUser>[1] = {
        displayName: editDisplayName.trim() || null,
        surname: editSurname.trim() || null,
        status: editStatus.trim() || undefined,
        city: editCity.trim() || undefined,
        referralLimit: refLimit === "" ? null : (parseInt(refLimit, 10) >= 0 ? parseInt(refLimit, 10) : null),
        boardApiHubPrimeCode: editBoardApiHubPrimeCode.trim() === "" ? null : editBoardApiHubPrimeCode.trim(),
      };
      if (canEditPublicId) {
        const rawPid = editPublicId.trim();
        if (!/^\d+$/u.test(rawPid)) {
          toast({
            variant: "destructive",
            title: "Некорректный публичный ID",
            description: "Только цифры, целое число от 1 до 2147483647.",
          });
          setEditLoading(false);
          return;
        }
        const pid = parseInt(rawPid, 10);
        if (pid < 1 || pid > 2_147_483_647) {
          toast({
            variant: "destructive",
            title: "Некорректный публичный ID",
            description: "Допустимый диапазон: 1…2147483647.",
          });
          setEditLoading(false);
          return;
        }
        if (pid !== editUser.publicId) {
          payload.publicId = pid;
        }
      }
      await updateAdminUser(editUser.id, payload);
      toast({ title: "Профиль обновлён" });
      setEditUser(null);
      setEditDisplayName("");
      setEditSurname("");
      setEditStatus("");
      setEditCity("");
      setEditReferralLimit("");
      setEditBoardApiHubPrimeCode("");
      setEditPublicId("");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: e instanceof Error ? e.message : "Не удалось сохранить профиль",
      });
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className={cn(adminPageStackClass(), "space-y-4")}>
      <AdminPageHeader
        title="Пользователи"
        description="Поиск, сортировка, пакетный бан и удаление, маркер риска по данным регистрации."
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени, телефону, ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <Button
          variant={showDeleted ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setShowDeleted(!showDeleted);
            setPage(0);
          }}
        >
          {showDeleted ? "Скрыть удалённых" : "Показать удалённых"}
        </Button>
      </div>
      <AdminPanelCard className="p-5 sm:p-6">
        <h2 className="mb-4 text-base font-semibold text-[hsl(210_20%_98%)]">Список</h2>
        <div>
          {isLoading && (
            <div className="space-y-2 py-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {error && (
            <ErrorWithRetry
              title="Не удалось загрузить пользователей"
              description={error instanceof Error ? error.message : "Ошибка загрузки"}
              onRetry={() => void refetch()}
              className="min-h-[180px]"
            />
          )}
          {data && data.users.length === 0 ? (
            <ListEmptyState
              icon={Search}
              title="Пользователи не найдены"
              description="По текущим фильтрам список пуст. Измените фильтры или обновите данные."
              actionLabel="Сбросить фильтры"
              onAction={() => {
                setSearch("");
                setShowDeleted(false);
                setPage(0);
                void refetch();
              }}
              className="min-h-[180px]"
            />
          ) : null}
          {data && data.users.length > 0 && (
            <>
              {selectedIds.size > 0 ? (
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
                  <span className="text-sm font-medium text-[hsl(210_20%_98%)]">
                    Выбрано: {selectedIds.size}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[var(--uix-touch-min)]"
                    onClick={() => {
                      setBulkBanReason("");
                      setBulkAction("ban");
                    }}
                  >
                    <Ban className="h-4 w-4 mr-1" />
                    Забанить выбранных
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[var(--uix-touch-min)]"
                    onClick={() => setBulkAction("delete")}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Удалить выбранных (скрыть)
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-[var(--uix-touch-min)]"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Снять выбор
                  </Button>
                </div>
              ) : null}
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[1220px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 pr-0">
                      <Checkbox
                        checked={
                          allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false
                        }
                        onCheckedChange={(v) => toggleSelectAllPage(v === true)}
                        aria-label="Выбрать всех на странице"
                      />
                    </TableHead>
                    <TableHead className="w-[72px]">Внимание</TableHead>
                    <TableHead>ID</TableHead>
                    <SortableTableHead
                      label="Регистрация"
                      column="createdAt"
                      activeColumn={sortBy}
                      dir={sortDir}
                      onSort={handleSortColumn}
                      className="whitespace-nowrap min-w-[128px]"
                    />
                    <TableHead>Имя</TableHead>
                    <SortableTableHead
                      label="Кем приглашён"
                      column="invitedBy"
                      activeColumn={sortBy}
                      dir={sortDir}
                      onSort={handleSortColumn}
                      className="max-w-[200px]"
                    />
                    <SortableTableHead
                      label="Приглашено"
                      column="referrals"
                      activeColumn={sortBy}
                      dir={sortDir}
                      onSort={handleSortColumn}
                      className="whitespace-nowrap"
                    />
                    <TableHead>API HUB</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="pr-0">
                        <Checkbox
                          checked={selectedIds.has(u.id)}
                          onCheckedChange={(v) => toggleRowSelected(u.id, v === true)}
                          aria-label={`Выбрать пользователя ${u.publicId}`}
                        />
                      </TableCell>
                      <TableCell>
                        <SignupAttentionCell risk={u.signupRisk} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{u.publicId}</TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {formatUserRegisteredAt(u.createdAt)}
                      </TableCell>
                      <TableCell>
                        {[u.displayName, u.surname].filter(Boolean).join(" ") || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[220px]">
                        {u.invitedByUser ? (
                          <span className="break-words">
                            <span className="font-mono text-xs">ID {u.invitedByUser.publicId}</span>
                            {([u.invitedByUser.displayName, u.invitedByUser.surname].filter(Boolean).join(" ") ||
                              "") && (
                              <>
                                {" · "}
                                {[u.invitedByUser.displayName, u.invitedByUser.surname].filter(Boolean).join(" ")}
                              </>
                            )}
                          </span>
                        ) : u.invitedById ? (
                          <span className="text-xs text-amber-600 dark:text-amber-500" title={u.invitedById}>
                            Нет в базе
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.referralCount != null ? u.referralCount : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {u.boardApiHubPrimeCode && String(u.boardApiHubPrimeCode).trim() ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">PRIME</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {u.isBlocked ? (
                          <span className="text-destructive font-medium">Заблокирован</span>
                        ) : u.deletedAt ? (
                          <span className="text-muted-foreground">Удалён</span>
                        ) : (
                          <span className="text-muted-foreground">Активен</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailUserId(u.id)}
                          aria-label={`Детали регистрации пользователя ${u.publicId}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Детали
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                          <Pencil className="w-4 h-4 mr-1" />
                          Редактировать
                        </Button>
                        {u.isBlocked ? (
                          <Button variant="outline" size="sm" onClick={() => openUnban(u)}>
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Разбанить
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => openBan(u)}>
                            <Ban className="w-4 h-4 mr-1" />
                            Бан
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-2"
                          onClick={() => openDelete(u)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Удалить
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="ml-2"
                          onClick={() => openPurge(u)}
                          title="Только admin/super_admin: полное удаление из базы"
                        >
                          <UserX className="w-4 h-4 mr-1" />
                          Из системы
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Всего: {data.total} | стр. {page + 1}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Назад
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(page + 1) * PAGE_SIZE >= data.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Далее
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </AdminPanelCard>

      <BusinessStatusRequestsSection />

      <Dialog
        open={!!editUser}
        onOpenChange={(open) => {
          if (!open) {
            setEditUser(null);
            setEditDisplayName("");
            setEditSurname("");
            setEditStatus("");
            setEditCity("");
            setEditReferralLimit("");
            setEditBoardApiHubPrimeCode("");
            setEditPublicId("");
          }
        }}
      >
        <DialogContent className={adminDialogSurfaceClass}>
          <DialogHeader>
            <DialogTitle>Редактирование пользователя</DialogTitle>
            <DialogDescription>
              Обновите основные поля профиля. Остальные настройки пользователь может поменять сам в приложении.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {editUser ? (
              <p className="text-xs text-muted-foreground font-mono break-all">
                Внутренний ID (не меняется): {editUser.id}
              </p>
            ) : null}
            <div className="space-y-1">
              <label className="text-sm font-medium">Публичный ID</label>
              <Input
                type="number"
                min={1}
                value={editPublicId}
                onChange={(e) => setEditPublicId(e.target.value)}
                placeholder="Номер профиля в поиске и ссылках"
                disabled={!canEditPublicId}
                className={!canEditPublicId ? "opacity-70" : undefined}
              />
              <p className="text-xs text-muted-foreground">
                {canEditPublicId
                  ? "Целое число, уникальное в системе. Старые ссылки с прошлым номером перестанут совпадать. Внутренний UUID аккаунта не меняется."
                  : "Менять публичный ID могут только роли admin и super_admin."}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Имя</label>
              <Input
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="Имя"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Фамилия</label>
              <Input
                value={editSurname}
                onChange={(e) => setEditSurname(e.target.value)}
                placeholder="Фамилия"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Статус</label>
              <Input
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                placeholder="Например: онлайн / занят"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Город</label>
              <Input
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                placeholder="Город"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Лимит приглашений</label>
              <Input
                type="number"
                min={0}
                value={editReferralLimit}
                onChange={(e) => setEditReferralLimit(e.target.value)}
                placeholder="3 (по умолчанию)"
              />
              <p className="text-xs text-muted-foreground">
                Пусто = 3. Укажите число (0, 5, 10…) чтобы задать лимит. Админ может увеличить для активных пользователей.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">PRIME CODE (API HUB)</label>
              <Input
                value={editBoardApiHubPrimeCode}
                onChange={(e) => setEditBoardApiHubPrimeCode(e.target.value)}
                placeholder="Пусто — без доступа к API HUB на Борде"
                maxLength={64}
              />
              <p className="text-xs text-muted-foreground">
                Любая непустая строка (до 64 символов) даёт пользователю плитку «API HUB» в разделе Борд. Очистите поле,
                чтобы отозвать доступ.
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditUser(null);
                setEditDisplayName("");
                setEditSurname("");
                setEditStatus("");
                setEditCity("");
                setEditReferralLimit("");
                setEditBoardApiHubPrimeCode("");
                setEditPublicId("");
              }}
            >
              Отмена
            </Button>
            <Button size="sm" onClick={runEditSave} disabled={editLoading}>
              {editLoading ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={
          !!actionUser &&
          (actionType === "ban" || actionType === "unban" || actionType === "delete" || actionType === "purge")
        }
        onOpenChange={(open) => {
          if (!open) {
            setActionUser(null);
            setActionType(null);
            setBanReason("");
            setPurgeConfirmPublicId("");
            setPurgeReason("");
          }
        }}
      >
        <AlertDialogContent className={adminDialogSurfaceClass}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "ban" && "Заблокировать пользователя?"}
              {actionType === "unban" && "Разблокировать пользователя?"}
              {actionType === "delete" && "Удалить аккаунт (скрыть)?"}
              {actionType === "purge" && "Удалить пользователя из системы безвозвратно?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              {actionUser && (
                <>
                  {[actionUser.displayName, actionUser.surname].filter(Boolean).join(" ") || "Без имени"} · публичный ID{" "}
                  {actionUser.publicId}
                </>
              )}
              {actionType === "delete" && (
                <> Аккаунт скроется из списков (мягкое удаление). Данные в базе сохраняются.</>
              )}
              {actionType === "purge" && (
                <>
                  {" "}
                  Безвозвратное удаление строки пользователя и связанных данных (каскад в БД). Доступно только admin /
                  super_admin.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionType === "purge" && (
            <div className="px-6 pb-2 space-y-3 text-sm">
              <p className="text-destructive font-medium text-sm">
                Восстановление невозможно. Введите публичный ID ниже для подтверждения.
              </p>
              <div>
                <label className="text-sm font-medium">Публичный ID</label>
                <Input
                  inputMode="numeric"
                  value={purgeConfirmPublicId}
                  onChange={(e) => setPurgeConfirmPublicId(e.target.value)}
                  placeholder={actionUser ? String(actionUser.publicId) : ""}
                  className="mt-1 font-mono"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Причина в журнал аудита (необязательно)</label>
                <Input
                  value={purgeReason}
                  onChange={(e) => setPurgeReason(e.target.value)}
                  placeholder="Например: мультиаккаунты / спам"
                  className="mt-1"
                />
              </div>
            </div>
          )}
          {actionType === "ban" && (
            <div className="px-6 pb-2">
              <label className="text-sm font-medium">Причина (необязательно)</label>
              <Input
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Причина бана"
                className="mt-1"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (actionType === "purge") {
                  const n = parsePublicIdForConfirm(purgeConfirmPublicId);
                  const expectedPublicId = actionUser ? normalizeAdminPublicId(actionUser.publicId) : NaN;
                  if (!actionUser || !Number.isFinite(n) || !Number.isFinite(expectedPublicId) || n !== expectedPublicId) {
                    toast({
                      variant: "destructive",
                      title: "Введите верный публичный ID",
                      description: actionUser ? `Ожидается число ${expectedPublicId}` : "",
                    });
                    return;
                  }
                }
                void runAction();
              }}
            >
              {actionType === "ban" && "Заблокировать"}
              {actionType === "unban" && "Разблокировать"}
              {actionType === "delete" && "Удалить"}
              {actionType === "purge" && "Удалить из системы"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBulkAction(null);
            setBulkBanReason("");
          }
        }}
      >
        <AlertDialogContent className={adminDialogSurfaceClass}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === "ban" && `Заблокировать выбранных: ${selectedIds.size}?`}
              {bulkAction === "delete" && `Удалить (скрыть) выбранных: ${selectedIds.size}?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              {bulkAction === "ban" && <>Пользователи не смогут пользоваться сервисом, пока вы не разбаните их вручную.</>}
              {bulkAction === "delete" && (
                <>Мягкое удаление: аккаунты скроются из списков, строки в БД сохраняются.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {bulkAction === "ban" && (
            <div className="px-6 pb-2">
              <label className="text-sm font-medium">Причина (необязательно)</label>
              <Input
                value={bulkBanReason}
                onChange={(e) => setBulkBanReason(e.target.value)}
                placeholder="Причина бана"
                className="mt-1"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkWorking}
              onClick={(e) => {
                e.preventDefault();
                void runBulkAction();
              }}
            >
              {bulkWorking ? "Подождите…" : bulkAction === "ban" ? "Заблокировать" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!detailUserId}
        onOpenChange={(open) => {
          if (!open) setDetailUserId(null);
        }}
      >
        <DialogContent className={cn("max-w-2xl max-h-[90vh] overflow-y-auto", adminDialogSurfaceClass)}>
          <DialogHeader>
            <DialogTitle>Детали регистрации</DialogTitle>
            <DialogDescription>
              Сигналы при создании аккаунта и другие пользователи с теми же признаками. Эвристика, не доказательство.
            </DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading && <Skeleton className="h-20 w-full" />}
          {detailQuery.isError && (
            <ErrorWithRetry
              title="Не удалось загрузить детали регистрации"
              description={detailQuery.error instanceof Error ? detailQuery.error.message : "Ошибка загрузки"}
              onRetry={() => void detailQuery.refetch()}
              className="min-h-[180px]"
            />
          )}
          {detailQuery.data && (
            <UserSignupDetailBody payload={detailQuery.data} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
