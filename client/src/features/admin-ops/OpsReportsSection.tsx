import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Flag } from "lucide-react";
import { fetchMe } from "@/lib/auth";
import { adminOpsUi } from "./i18n.ru";
import { fetchOpsReports, patchOpsReport } from "./api";

const QK = ["admin", "ops", "reports"] as const;

export function OpsReportsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const canResolve = me?.platformRole === "admin" || me?.platformRole === "super_admin";
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...QK, filter],
    queryFn: () => fetchOpsReports({ status: filter === "open" ? "open" : undefined, limit: 80, offset: 0 }),
  });

  const mut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "resolved" | "dismissed" }) =>
      patchOpsReport(id, { status, adminNote: notes[id]?.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast({ title: "Обновлено" });
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }),
  });

  const rows = data?.reports ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Flag className="w-4 h-4" />
          {adminOpsUi.reportsCard}
        </CardTitle>
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant={filter === "open" ? "default" : "outline"} onClick={() => setFilter("open")}>
            {adminOpsUi.statusOpen}
          </Button>
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
            {adminOpsUi.statusAll}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
        {error && (
          <div className="space-y-2">
            <p className="text-destructive text-sm">{adminOpsUi.reportsLoadError}</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Повторить
            </Button>
          </div>
        )}
        {!isLoading && !error && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">{adminOpsUi.reportsEmpty}</p>
        )}
        {!isLoading && !error && rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{adminOpsUi.date}</TableHead>
                <TableHead>{adminOpsUi.target}</TableHead>
                <TableHead>{adminOpsUi.reason}</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: ru })}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {r.targetType} · {r.targetId.slice(0, 24)}
                    {r.targetId.length > 24 ? "…" : ""}
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate" title={r.reason}>
                    {r.reason}
                  </TableCell>
                  <TableCell className="text-sm">{r.status}</TableCell>
                  <TableCell className="text-right space-y-2">
                    {r.status === "open" && canResolve ? (
                      <>
                        <Input
                          placeholder={adminOpsUi.adminNote}
                          value={notes[r.id] ?? ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                          className="h-8 text-xs mb-1"
                        />
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={mut.isPending}
                            onClick={() => mut.mutate({ id: r.id, status: "resolved" })}
                          >
                            {adminOpsUi.resolve}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={mut.isPending}
                            onClick={() => mut.mutate({ id: r.id, status: "dismissed" })}
                          >
                            {adminOpsUi.dismiss}
                          </Button>
                        </div>
                      </>
                    ) : r.status === "open" && !canResolve ? (
                      <span className="text-xs text-muted-foreground">Только админ</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{r.adminNote ?? "—"}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
