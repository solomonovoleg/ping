import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  fetchAdminBusinessStatusRequests,
  moderateAdminBusinessStatusRequest,
  type AdminBusinessStatusRequest,
} from "@/lib/admin";
import { BadgeCheck, BadgeX, RotateCcw, BriefcaseBusiness } from "lucide-react";

type QueueStatus = "submitted" | "approved" | "rejected" | "revision_required";

const STATUS_LABEL: Record<QueueStatus, string> = {
  submitted: "Новые",
  approved: "Одобренные",
  rejected: "Отклоненные",
  revision_required: "Пересмотр",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU");
}

function QueueCard({
  item,
  comment,
  setComment,
  onAction,
  working,
}: {
  item: AdminBusinessStatusRequest;
  comment: string;
  setComment: (value: string) => void;
  onAction: (action: "approve" | "reject" | "revision") => void;
  working: boolean;
}) {
  const fullName = [item.user.displayName, item.user.surname].filter(Boolean).join(" ") || "Без имени";
  return (
    <div className="rounded-lg border border-border/70 bg-background p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {fullName} · ID {item.user.publicId}
          </p>
          <p className="text-xs text-muted-foreground">Отправлено: {formatDate(item.createdAt)}</p>
        </div>
        <span className="text-xs rounded-md border px-2 py-1 bg-secondary/40">
          {STATUS_LABEL[item.status as QueueStatus] ?? item.status}
        </span>
      </div>
      <p className="text-sm whitespace-pre-wrap">{item.reason}</p>
      {item.links.length > 0 ? (
        <div className="space-y-1">
          {item.links.map((link, idx) => (
            <a
              key={`${item.id}-link-${idx}`}
              href={link}
              target="_blank"
              rel="noreferrer"
              className="block text-xs text-primary underline break-all"
            >
              {link}
            </a>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Ссылки не указаны</p>
      )}
      <Input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Комментарий модератора (необязательно)"
        disabled={working || item.status !== "submitted"}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-[var(--uix-touch-min)]"
          disabled={working || item.status !== "submitted"}
          onClick={() => onAction("approve")}
        >
          <BadgeCheck className="h-4 w-4 mr-1" />
          Принять
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[var(--uix-touch-min)]"
          disabled={working || item.status !== "submitted"}
          onClick={() => onAction("revision")}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          На пересмотр
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="min-h-[var(--uix-touch-min)]"
          disabled={working || item.status !== "submitted"}
          onClick={() => onAction("reject")}
        >
          <BadgeX className="h-4 w-4 mr-1" />
          Отклонить
        </Button>
      </div>
      {item.adminComment ? (
        <p className="text-xs text-muted-foreground rounded-md border border-border/70 bg-secondary/20 p-2">
          Комментарий: {item.adminComment}
        </p>
      ) : null}
    </div>
  );
}

export function BusinessStatusRequestsSection() {
  const [status, setStatus] = useState<QueueStatus>("submitted");
  const [comments, setComments] = useState<Record<string, string>>({});
  const [workingRequestId, setWorkingRequestId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queueQuery = useQuery({
    queryKey: ["admin", "business-status-requests", status],
    queryFn: () => fetchAdminBusinessStatusRequests({ status, limit: 50, offset: 0 }),
  });

  const moderateMutation = useMutation({
    mutationFn: async (args: { id: string; action: "approve" | "reject" | "revision" }) => {
      setWorkingRequestId(args.id);
      await moderateAdminBusinessStatusRequest(args.id, args.action, comments[args.id]);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "business-status-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({ title: "Заявка обработана" });
    },
    onError: (err) => {
      toast({
        title: "Не удалось обработать заявку",
        description: err instanceof Error ? err.message : "Повторите позже",
        variant: "destructive",
      });
    },
    onSettled: () => setWorkingRequestId(null),
  });

  const items = queueQuery.data?.items ?? [];

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-secondary/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Заявки на бизнес-статус</h3>
          <p className="text-sm text-muted-foreground">
            Очередь модерации: принять, отклонить или отправить на пересмотр.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_LABEL) as QueueStatus[]).map((nextStatus) => (
            <Button
              key={nextStatus}
              type="button"
              size="sm"
              variant={status === nextStatus ? "default" : "outline"}
              className="min-h-[var(--uix-touch-min)]"
              onClick={() => setStatus(nextStatus)}
            >
              {STATUS_LABEL[nextStatus]}
            </Button>
          ))}
        </div>
      </div>

      {queueQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {queueQuery.isError ? (
        <ErrorWithRetry
          title="Не удалось загрузить заявки"
          description={queueQuery.error instanceof Error ? queueQuery.error.message : "Ошибка загрузки"}
          onRetry={() => void queueQuery.refetch()}
          className="min-h-[120px]"
        />
      ) : null}

      {!queueQuery.isLoading && !queueQuery.isError && items.length === 0 ? (
        <ListEmptyState
          icon={BriefcaseBusiness}
          title="Заявок нет"
          description="В выбранном фильтре пока нет записей."
          actionLabel="Обновить"
          onAction={() => void queueQuery.refetch()}
          className="min-h-[120px]"
        />
      ) : null}

      {!queueQuery.isLoading && !queueQuery.isError && items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              comment={comments[item.id] ?? ""}
              setComment={(value) => setComments((prev) => ({ ...prev, [item.id]: value }))}
              working={moderateMutation.isPending && workingRequestId === item.id}
              onAction={(action) => moderateMutation.mutate({ id: item.id, action })}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
