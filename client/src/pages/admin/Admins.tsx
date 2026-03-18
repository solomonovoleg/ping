import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { fetchAdmins, setAdminRole, type AdminEntry } from "@/lib/admin";
import { useToast } from "@/hooks/use-toast";

const ROLES = ["moderator", "admin", "super_admin"] as const;

export default function AdminAdmins() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: admins, isLoading, error } = useQuery({
    queryKey: ["admin", "admins"],
    queryFn: fetchAdmins,
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Админы и роли</h1>
      <Card>
        <CardHeader>
          <CardTitle>Платформенные администраторы</CardTitle>
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
                  <TableHead>Телефон</TableHead>
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
                    <TableCell>{u.phone}</TableCell>
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
    </div>
  );
}
