import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminVkParserItem } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { formatVkParserRelativeTime } from "./vk-parser-dates";
import { VkParserMediaThumb } from "./VkParserMediaThumb";

function statusBadgeClass(status: string): string {
  switch (status) {
    case "pending_review":
      return "border-amber-500/45 bg-amber-500/10 text-amber-900 dark:text-amber-100";
    case "published":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100";
    case "rejected":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "failed":
      return "border-destructive/60 bg-destructive/15 text-destructive font-semibold";
    case "skipped":
      return "text-muted-foreground";
    default:
      return "";
  }
}

/** Общие стили обёртки `li` / `motion.li` (см. `VkParserQueueAnimatedList`). */
export const VK_PARSER_QUEUE_ROW_CLASS = cn(
  "rounded-xl border border-border/80 p-3 sm:p-4 space-y-2 list-none",
  "bg-card/30 hover:bg-muted/25",
);

/** Тело строки очереди без обёртки списка — рядом с `motion.li` в `AnimatePresence`. */
export function VkParserQueueItemContent(props: {
  item: AdminVkParserItem;
  bindingLabel: string;
  statusLabel: string;
  onApprove: () => void;
  onReject: () => void;
  approvingThis: boolean;
  rejectingThis: boolean;
}) {
  const rowBusy = props.approvingThis || props.rejectingThis;
  const urls = props.item.mediaUrls ?? [];
  const canModerate = props.item.status === "pending_review";
  const rel = formatVkParserRelativeTime(props.item.createdAt);

  return (
    <>
      <div className="flex flex-wrap items-start gap-2 justify-between gap-y-1">
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground truncate">{props.bindingLabel}</p>
          <p className="text-[11px] text-muted-foreground font-mono truncate" title={props.item.vkPostKey}>
            {props.item.vkPostKey}
            {rel ? <span className="text-muted-foreground/80 font-sans"> · {rel}</span> : null}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5",
            statusBadgeClass(props.item.status),
          )}
        >
          {props.statusLabel}
        </Badge>
      </div>
      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{props.item.postText || "·"}</p>
      {props.item.errorMessage ? (
        <p className="text-xs text-destructive break-words rounded-md bg-destructive/5 border border-destructive/15 px-2 py-1.5">
          {props.item.errorMessage}
        </p>
      ) : null}
      {props.item.platformPostId ? (
        <p className="text-xs text-muted-foreground font-mono">
          Пост в ленте: <span className="select-all">{props.item.platformPostId}</span>
        </p>
      ) : null}
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.slice(0, 6).map((u, i) => (
            <VkParserMediaThumb key={`${u}-${i}`} src={u} index={i} />
          ))}
        </div>
      )}
      {canModerate ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            className="min-h-[var(--uix-touch-min)]"
            disabled={rowBusy}
            onClick={props.onApprove}
          >
            {props.approvingThis ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
            В ленту
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-[var(--uix-touch-min)]"
            disabled={rowBusy}
            onClick={props.onReject}
          >
            {props.rejectingThis ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
            Отклонить
          </Button>
        </div>
      ) : null}
    </>
  );
}
