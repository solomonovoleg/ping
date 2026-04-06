import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  AdminPageHeader,
  AdminSectionTemplate,
  adminDialogSurfaceClass,
  adminPageStackClass,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { fetchAdmins, setAdminRole, fetchAdminUsers, type AdminEntry } from "@/lib/admin";
import { useToast } from "@/hooks/use-toast";
import { ShieldUser, UserPlus, Search } from "lucide-react";

const ROLES = ["moderator", "admin", "super_admin"] as const;

export default function AdminAdmins() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addRole, setAddRole] = useState<string>("moderator");
  const [addLoading, setAddLoading] = useState(false);

  const { data: admins, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "admins"],
    queryFn: fetchAdmins,
  });

  const { data: searchUsers, isLoading: searchLoading } = useQuery({
    queryKey: ["admin", "users", "add-search", addSearch],
    queryFn: () => fetchAdminUsers({ limit: 15, search: addSearch || undefined }),
    enabled: addOpen && addSearch.length >= 2,
  });

  const changeRole = async (user: AdminEntry, newRole: string) => {
    try {
      await setAdminRole(user.id, newRole);
      toast({ title: "Роль обновлена" });
      queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: e instanceof Error ? e.message : "Не удалось изменить роль",
      });
    }
  };

  const handleAddAdmin = async (userId: string) => {
    setAddLoading(true);
    try {
      await setAdminRole(userId, addRole);
      toast({ title: "Роль назначена" });
      setAddOpen(false);
      setAddSearch("");
      queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: e instanceof Error ? e.message : "Не удалось назначить роль",
      });
    } finally {
      setAddLoading(false);
    }
  };

  const adminIds = new Set(admins?.map((a) => a.id) ?? []);
  const searchResults = searchUsers?.users.filter((u) => !u.deletedAt) ?? [];

  return (
    <div className={cn(adminPageStackClass(), "space-y-4")}>
      <AdminPageHeader
        title="Админы и роли"
        description="Платформенные роли moderator, admin, super_admin."
      />
      <AdminSectionTemplate
        title="Платформенные администраторы"
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="mr-1 h-4 w-4" />
            Добавить админа
          </Button>
        }
        isLoading={isLoading}
        loadingRows={3}
        error={error}
        onRetry={() => void refetch()}
        errorTitle="Не удалось загрузить администраторов"
        empty={!!admins && admins.length === 0}
        emptyIcon={ShieldUser}
        emptyTitle="Нет назначенных администраторов"
        emptyDescription="Добавьте первого администратора, чтобы управлять ролями и модерацией."
        emptyActionLabel="Добавить админа"
        onEmptyAction={() => setAddOpen(true)}
      >
        {admins && admins.length > 0 ? (
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Имя</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead className="w-40">Изменить роль</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-xs">{u.publicId}</TableCell>
                    <TableCell>
                      {[u.displayName, u.surname].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{u.platformRole}</span>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.platformRole}
                        onValueChange={(v) => changeRole(u, v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
          </Table>
        ) : null}
      </AdminSectionTemplate>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className={adminDialogSurfaceClass}>
          <DialogHeader>
            <DialogTitle>Добавить админа</DialogTitle>
            <DialogDescription>
              Найдите пользователя по имени, нику или ID и назначьте роль (moderator, admin, super_admin).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по имени, @нику, ID…"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Роль</label>
              <Select value={addRole} onValueChange={setAddRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {addSearch.length >= 2 && (
              <div className="border rounded-lg p-2 max-h-48 overflow-y-auto">
                {searchLoading ? (
                  <p className="text-muted-foreground text-sm py-2">Поиск...</p>
                ) : searchResults.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-2">Ничего не найдено</p>
                ) : (
                  <ul className="space-y-1">
                    {searchResults.map((u) => (
                      <li key={u.id}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => handleAddAdmin(u.id)}
                          disabled={addLoading || adminIds.has(u.id)}
                        >
                          {[u.displayName, u.surname].filter(Boolean).join(" ") || `ID ${u.publicId}`}
                          {adminIds.has(u.id) && (
                            <span className="ml-2 text-muted-foreground text-xs">— уже админ</span>
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
