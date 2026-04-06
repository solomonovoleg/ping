import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminPanelCard } from "@/features/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
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
import { Copy, Flag } from "lucide-react";
import { fetchMe } from "@/lib/auth";
import { adminOpsUi } from "./i18n.ru";
import { fetchOpsReports, patchOpsReport } from "./api";
import { OpsReportTargetCell } from "./OpsReportTargetCell";
import { OpsReportRowModeration } from "./OpsReportRowModeration";
import { formatOpsReportReasonCode, formatOpsReportStatus } from "./ops-report-display-labels";

const QK = ["admin", "ops", "reports"] as const;

export function OpsReportsSection() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const canResolve = me?.platformRole === "admin" || me?.platformRole === "super_admin";
  const canRemoveContent =
    me?.platformRole === "moderator" || me?.platformRole === "admin" || me?.platformRole === "super_admin";
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
      toast({ title: adminOpsUi.reportsUpdated });
    },
    onError: (e) =>
      toast({
        title: e instanceof Error ? e.message : adminOpsUi.reportsPatchError,
        variant: "destructive",
      }),
  });

  const rows = data?.reports ?? [];

  return (
    <AdminPanelCard className="p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold text-[hsl(210_20%_98%)]">
          <Flag className="h-4 w-4 shrink-0" aria-hidden />
          <span>{adminOpsUi.reportsCard}</span>
          {!isLoading && !error && data != null ? (
            <span className="text-xs font-normal text-muted-foreground">· {adminOpsUi.totalReports}: {data.total}</span>
          ) : null}
        </h2>
        <p className="mt-1 max-w-3xl text-[11px] leading-snug text-muted-foreground/90">
          {adminOpsUi.reportsCardReviewHint}
        </p>
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant={filter === "open" ? "default" : "outline"} onClick={() => setFilter("open")}>
            {adminOpsUi.statusOpen}
          </Button>
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
            {adminOpsUi.statusAll}
          </Button>
        </div>
      </div>
      <div>
        {isLoading && (
          <div className="space-y-2 py-1" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        )}
        {error && (
          <ErrorWithRetry
            title="Не удалось загрузить список жалоб"
            description={error instanceof Error ? error.message : adminOpsUi.reportsLoadError}
            onRetry={() => void refetch()}
            className="min-h-[180px]"
          />
        )}
        {!isLoading && !error && rows.length === 0 && (
          <div className="space-y-3">
            <ListEmptyState
              icon={Flag}
              title={filter === "open" ? adminOpsUi.reportsEmptyOpen : adminOpsUi.reportsEmptyAll}
              description={adminOpsUi.reportsEmptySlaHint}
              secondaryActionLabel={adminOpsUi.reportsCheatsheetApple}
              onSecondaryAction={() => setLocation("/admin/store-review")}
              actionLabel={adminOpsUi.reportsCheatsheetPlay}
              onAction={() => setLocation("/admin/store-review-play")}
              className="min-h-[180px]"
            />
          </div>
        )}
        {!isLoading && !error && rows.length > 0 && (
          <div className="w-full overflow-x-auto rounded-md border border-[hsl(var(--admin-border)/0.35)]">
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead>{adminOpsUi.date}</TableHead>
                <TableHead>{adminOpsUi.reporter}</TableHead>
                <TableHead>{adminOpsUi.target}</TableHead>
                <TableHead>{adminOpsUi.category}</TableHead>
                <TableHead>{adminOpsUi.reason}</TableHead>
                <TableHead>{adminOpsUi.statusColumn}</TableHead>
                <TableHead className="text-right">{adminOpsUi.moderation}</TableHead>
                <TableHead className="text-right">{adminOpsUi.actionsColumn}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: ru })}
                  </TableCell>
                  <TableCell className="align-top text-xs">
                    <div className="font-mono text-[11px] max-w-[120px] truncate" title={r.reporterUserId}>
                      {r.reporterUserId.slice(0, 12)}
                      {r.reporterUserId.length > 12 ? "…" : ""}
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-1 h-6 gap-1 px-1.5 text-[10px]"
                      onClick={() =>
                        void navigator.clipboard?.writeText(r.reporterUserId).then(
                          () => toast({ title: adminOpsUi.reporterIdCopied }),
                          () => toast({ title: adminOpsUi.reporterIdCopyFailed, variant: "destructive" }),
                        )
                      }
                    >
                      <Copy className="h-3 w-3 opacity-80" aria-hidden />
                      ID
                    </Button>
                  </TableCell>
                  <TableCell className="align-top">
                    <OpsReportTargetCell
                      targetType={r.targetType}
                      targetId={r.targetId}
                      contextPostId={r.contextPostId}
                      contextChatId={r.contextChatId}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap max-w-[140px]">
                    {formatOpsReportReasonCode(r.reasonCode)}
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate" title={r.reason}>
                    {r.reason}
                  </TableCell>
                  <TableCell className="text-sm">{formatOpsReportStatus(r.status)}</TableCell>
                  <TableCell className="text-right align-top">
                    <OpsReportRowModeration row={r} canRemoveContent={canRemoveContent} />
                  </TableCell>
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
                      <span className="text-xs text-muted-foreground">{adminOpsUi.reportsAdminOnlyResolve}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{r.adminNote ?? "—"}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </div>
    </AdminPanelCard>
  );
}
