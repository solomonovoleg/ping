import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import type { ReactNode } from "react";

export function CommentBlockMenu({
  canInteract,
  commentId,
  commentUserId,
  commentUserName,
  onReportRequest,
  onBlockRequest,
  children,
}: {
  /** Длинное нажатие: жалоба и/или блокировка (чужой комментарий, пользователь вошёл). */
  canInteract: boolean;
  commentId: string;
  commentUserId: string;
  commentUserName: string;
  onReportRequest?: (commentId: string) => void;
  onBlockRequest: (userId: string, name: string) => void;
  children: ReactNode;
}) {
  if (!canInteract) return <>{children}</>;
  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild>
        <div className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[200px]">
        {onReportRequest ? (
          <ContextMenuItem onSelect={() => requestAnimationFrame(() => onReportRequest(commentId))}>
            Пожаловаться…
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => onBlockRequest(commentUserId, commentUserName)}
        >
          Заблокировать…
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
