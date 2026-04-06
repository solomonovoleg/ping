import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AdminPageHeader, AdminSectionTemplate, adminPageStackClass } from "@/features/admin-shell";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  downloadAdminAuditCsv,
  fetchAuditLog,
  type AuditLogEntry,
  type FetchAuditLogOpts,
} from "@/lib/admin";
import { fetchMe } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { ScrollText } from "lucide-react";

const PAGE_SIZE = 50;

export default function AdminAudit() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<FetchAuditLogOpts>({ limit: PAGE_SIZE, offset: 0 });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const canCsv = me?.platformRole === "admin" || me?.platformRole === "super_admin";

  const { data: log, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "audit", filters],
    queryFn: () => fetchAuditLog(filters),
  });

  const setF = (patch: Partial<FetchAuditLogOpts>) => {
    setFilters((prev) => ({ ...prev, ...patch, offset: patch.offset !== undefined ? patch.offset : 0 }));
  };

  const onCsv = async () => {
    try {
      await downloadAdminAuditCsv();
      toast({ title: "CSV скачан" });
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Не удалось выгрузить CSV",
        variant: "destructive",
      });
    }
  };

  return (
    <div className={cn(adminPageStackClass(), "space-y-4")}>
      <AdminPageHeader title="Аудит" description="Журнал действий администраторов с фильтрами и постраничной навигацией." />
      <AdminSectionTemplate
        title="Действия админов"
        actions={
          canCsv ? (
            <Button type="button" variant="outline" size="sm" onClick={onCsv}>
              Скачать CSV (до 2000)
            </Button>
          ) : (
            <p className="text-xs admin-text-muted">CSV — только у администратора</p>
          )
        }
        bodyClassName="space-y-4"
        isLoading={isLoading}
        loadingRows={3}
        error={error}
        onRetry={() => void refetch()}
        errorTitle="Не удалось загрузить аудит"
        empty={!!log && log.length === 0}
        emptyIcon={ScrollText}
        emptyTitle="Записей пока нет"
        emptyDescription="По текущим фильтрам журнал пуст. Измените фильтры или обновите список."
        emptyActionLabel="Обновить"
        onEmptyAction={() => void refetch()}
      >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="audit-action">Действие</Label>
              <Input
                id="audit-action"
                value={filters.action ?? ""}
                onChange={(e) => setF({ action: e.target.value })}
                placeholder="user.ban"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="audit-admin">adminId</Label>
              <Input
                id="audit-admin"
                value={filters.adminId ?? ""}
                onChange={(e) => setF({ adminId: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="audit-target">targetType</Label>
              <Input
                id="audit-target"
                value={filters.targetType ?? ""}
                onChange={(e) => setF({ targetType: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="audit-since">С даты (ISO)</Label>
              <Input
                id="audit-since"
                value={filters.since ?? ""}
                onChange={(e) => setF({ since: e.target.value })}
                placeholder="2025-01-01"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="audit-until">По дату (ISO)</Label>
              <Input
                id="audit-until"
                value={filters.until ?? ""}
                onChange={(e) => setF({ until: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button type="button" variant="secondary" size="sm" onClick={() => refetch()}>
                Обновить
              </Button>
            </div>
          </div>
          {log && log.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Время</TableHead>
                    <TableHead>Действие</TableHead>
                    <TableHead>Объект</TableHead>
                    <TableHead>Детали</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {log.map((entry: AuditLogEntry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true, locale: ru })}
                      </TableCell>
                      <TableCell className="font-medium">{entry.action}</TableCell>
                      <TableCell>
                        {entry.targetType} {entry.targetId && `#${entry.targetId.slice(0, 8)}`}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                        {entry.details && JSON.stringify(entry.details)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {log.length === (filters.limit ?? PAGE_SIZE) && (
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setF({ offset: (filters.offset ?? 0) + (filters.limit ?? PAGE_SIZE) })
                    }
                  >
                    Следующая страница
                  </Button>
                  {(filters.offset ?? 0) > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setF({
                          offset: Math.max(0, (filters.offset ?? 0) - (filters.limit ?? PAGE_SIZE)),
                        })
                      }
                    >
                      Назад
                    </Button>
                  ) : null}
                </div>
              )}
            </>
          )}
      </AdminSectionTemplate>
    </div>
  );
}
