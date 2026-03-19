import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { fetchAdminUsers, banUser, unbanUser, deleteUser, updateAdminUser, type AdminUser } from "@/lib/admin";
import { Ban, RotateCcw, Trash2, Search, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const PAGE_SIZE = 20;

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false);
  const [actionUser, setActionUser] = useState<AdminUser | null>(null);
  const [actionType, setActionType] = useState<"ban" | "unban" | "delete" | null>(null);
  const [banReason, setBanReason] = useState("");
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editSurname, setEditSurname] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editReferralLimit, setEditReferralLimit] = useState<string>("");
  const [editLoading, setEditLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users", page, search, showDeleted],
    queryFn: () =>
      fetchAdminUsers({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        search: search || undefined,
        includeDeleted: showDeleted,
      }),
  });

  const runAction = async () => {
    if (!actionUser || !actionType) return;
    try {
      if (actionType === "ban") await banUser(actionUser.id, banReason);
      else if (actionType === "unban") await unbanUser(actionUser.id);
      else if (actionType === "delete") await deleteUser(actionUser.id);
      toast({
        title: actionType === "ban" ? "Заблокировано" : actionType === "unban" ? "Разблокировано" : "Удалено",
      });
      setActionUser(null);
      setActionType(null);
      setBanReason("");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard", "stats"] });
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

  const openEdit = (u: AdminUser) => {
    setEditUser(u);
    setEditDisplayName(u.displayName ?? "");
    setEditSurname(u.surname ?? "");
    setEditStatus("");
    setEditCity("");
    setEditReferralLimit(u.referralLimit != null ? String(u.referralLimit) : "");
  };

  const runEditSave = async () => {
    if (!editUser) return;
    setEditLoading(true);
    try {
      const refLimit = editReferralLimit.trim();
      await updateAdminUser(editUser.id, {
        displayName: editDisplayName.trim() || null,
        surname: editSurname.trim() || null,
        status: editStatus.trim() || undefined,
        city: editCity.trim() || undefined,
        referralLimit: refLimit === "" ? null : (parseInt(refLimit, 10) >= 0 ? parseInt(refLimit, 10) : null),
      });
      toast({ title: "Профиль обновлён" });
      setEditUser(null);
      setEditDisplayName("");
      setEditSurname("");
      setEditStatus("");
      setEditCity("");
      setEditReferralLimit("");
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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Пользователи</h1>
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
      <Card>
        <CardHeader>
          <CardTitle>Список</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-muted-foreground py-4">Загрузка...</p>}
          {error && (
            <p className="text-destructive py-4">
              {error instanceof Error ? error.message : "Ошибка загрузки"}
            </p>
          )}
          {data && (
            <>
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Имя</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>Пригласил</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs">{u.publicId}</TableCell>
                      <TableCell>
                        {[u.displayName, u.surname].filter(Boolean).join(" ") || "—"}
                      </TableCell>
                      <TableCell>{u.phone}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.referralCount != null ? u.referralCount : "—"}
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
        </CardContent>
      </Card>

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
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактирование пользователя</DialogTitle>
            <DialogDescription>
              Обновите основные поля профиля. Остальные настройки пользователь может поменять сам в приложении.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
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
        open={!!actionUser && (actionType === "ban" || actionType === "unban" || actionType === "delete")}
        onOpenChange={(open) => {
          if (!open) {
            setActionUser(null);
            setActionType(null);
            setBanReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "ban" && "Заблокировать пользователя?"}
              {actionType === "unban" && "Разблокировать пользователя?"}
              {actionType === "delete" && "Удалить аккаунт (скрыть)?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionUser &&
                `${[actionUser.displayName, actionUser.surname].filter(Boolean).join(" ") || actionUser.phone} (ID: ${actionUser.publicId})`}
              {actionType === "ban" && (
                <div className="mt-2">
                  <label className="text-sm font-medium">Причина (необязательно)</label>
                  <Input
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Причина бана"
                    className="mt-1"
                  />
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={runAction}>
              {actionType === "ban" && "Заблокировать"}
              {actionType === "unban" && "Разблокировать"}
              {actionType === "delete" && "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
