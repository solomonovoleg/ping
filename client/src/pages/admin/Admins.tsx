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
import { UserPlus, Search } from "lucide-react";

const ROLES = ["moderator", "admin", "super_admin"] as const;

export default function AdminAdmins() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addRole, setAddRole] = useState<string>("moderator");
  const [addLoading, setAddLoading] = useState(false);

  const { data: admins, isLoading, error } = useQuery({
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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Админы и роли</h1>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Платформенные администраторы</CardTitle>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="w-4 h-4 mr-1" />
            Добавить админа
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-muted-foreground py-4">Загрузка...</p>}
          {error && (
            <p className="text-destructive py-4">
              {error instanceof Error ? error.message : "Ошибка загрузки"}
            </p>
          )}
          {admins && admins.length === 0 && (
            <p className="text-muted-foreground py-4">Нет назначенных админов.</p>
          )}
          {admins && admins.length > 0 && (
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
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
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
