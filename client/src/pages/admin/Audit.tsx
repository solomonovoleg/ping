import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { fetchAuditLog } from "@/lib/admin";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

const PAGE_SIZE = 50;

export default function AdminAudit() {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { data: log, isLoading, error } = useQuery({
    queryKey: ["admin", "audit", limit],
    queryFn: () => fetchAuditLog({ limit }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Аудит</h1>
      <Card>
        <CardHeader>
          <CardTitle>Последние действия админов</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-muted-foreground py-4">Загрузка...</p>}
          {error && (
            <p className="text-destructive py-4">
              {error instanceof Error ? error.message : "Ошибка загрузки"}
            </p>
          )}
          {log && log.length === 0 && (
            <p className="text-muted-foreground py-4">Записей пока нет (или БД не используется).</p>
          )}
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
                  {log.map((entry) => (
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
              {log.length === limit && limit < 200 && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
                  >
                    Загрузить ещё
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
