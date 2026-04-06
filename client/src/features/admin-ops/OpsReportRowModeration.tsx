import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  deleteOpsModerationComment,
  deleteOpsModerationMessage,
  deleteOpsModerationPost,
  deleteOpsModerationStory,
  type OpsReportRow,
} from "./api";
import { adminOpsUi } from "./i18n.ru";

const QK = ["admin", "ops", "reports"] as const;

type Pending =
  | null
  | { kind: "post"; label: string; run: () => Promise<void> }
  | { kind: "story"; label: string; run: () => Promise<void> }
  | { kind: "message"; label: string; run: () => Promise<void> }
  | { kind: "comment"; label: string; run: () => Promise<void> };

export function OpsReportRowModeration({
  row,
  canRemoveContent,
}: {
  row: OpsReportRow;
  canRemoveContent: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [pending, setPending] = useState<Pending>(null);

  const mut = useMutation({
    mutationFn: async (fn: () => Promise<void>) => {
      await fn();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK });
      toast({ title: adminOpsUi.contentRemoved });
      setPending(null);
    },
    onError: (e) => {
      toast({
        title: e instanceof Error ? e.message : adminOpsUi.contentRemoveFailed,
        variant: "destructive",
      });
    },
  });

  if (!canRemoveContent) {
    return <span className="text-[11px] text-muted-foreground">{adminOpsUi.contentRemoveNoRights}</span>;
  }

  const actions: { key: string; label: string; onClick: () => void }[] = [];

  if (row.targetType === "post") {
    actions.push({
      key: "post",
      label: adminOpsUi.removePost,
      onClick: () =>
        setPending({
          kind: "post",
          label: adminOpsUi.removePostConfirm,
          run: () => deleteOpsModerationPost(row.targetId),
        }),
    });
  }
  if (row.targetType === "story") {
    actions.push({
      key: "story",
      label: adminOpsUi.removeStory,
      onClick: () =>
        setPending({
          kind: "story",
          label: adminOpsUi.removeStoryConfirm,
          run: () => deleteOpsModerationStory(row.targetId),
        }),
    });
  }
  if (row.targetType === "message" && row.contextChatId) {
    actions.push({
      key: "msg",
      label: adminOpsUi.removeMessage,
      onClick: () =>
        setPending({
          kind: "message",
          label: adminOpsUi.removeMessageConfirm,
          run: () => deleteOpsModerationMessage(row.contextChatId!, row.targetId),
        }),
    });
  }
  if (row.targetType === "comment" && row.contextPostId) {
    actions.push({
      key: "com",
      label: adminOpsUi.removeComment,
      onClick: () =>
        setPending({
          kind: "comment",
          label: adminOpsUi.removeCommentConfirm,
          run: () => deleteOpsModerationComment(row.contextPostId!, row.targetId),
        }),
    });
  }

  if (row.targetType === "user") {
    return (
      <span className="text-[11px] text-muted-foreground leading-snug">{adminOpsUi.removeUserHint}</span>
    );
  }

  if (actions.length === 0) {
    return (
      <span className="text-[11px] text-muted-foreground leading-snug">{adminOpsUi.contentRemoveUnavailable}</span>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1 items-end">
        {actions.map((a) => (
          <Button
            key={a.key}
            type="button"
            size="sm"
            variant="destructive"
            className="h-7 px-2 text-xs"
            disabled={mut.isPending}
            onClick={a.onClick}
          >
            {a.label}
          </Button>
        ))}
      </div>
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{adminOpsUi.contentRemoveDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{pending?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mut.isPending}>{adminOpsUi.cancelRemove}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={mut.isPending || !pending?.run}
              onClick={() => {
                if (pending?.run) void mut.mutateAsync(pending.run);
              }}
            >
              {adminOpsUi.confirmRemove}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
