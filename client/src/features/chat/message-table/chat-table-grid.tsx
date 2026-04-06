import { memo } from "react";
import { cn } from "@/lib/utils";

export type ChatTableGridVariant = "compact" | "comfortable";

type ChatTableGridProps = {
  rows: string[][];
  variant: ChatTableGridVariant;
  /** Первая строка чаще заголовок из Excel — чуть выделяем. */
  emphasizeFirstRow?: boolean;
  className?: string;
};

function EmptyCell() {
  return <span className="text-muted-foreground/35 select-none">—</span>;
}

function ChatTableGridInner({
  rows,
  variant,
  emphasizeFirstRow = true,
  className,
}: ChatTableGridProps) {
  const colCount = rows[0]?.length ?? 0;
  if (colCount === 0) return null;

  const compact = variant === "compact";

  return (
    <table
      className={cn(
        "w-max min-w-full border-separate border-spacing-0 text-left",
        compact ? "text-[12px] leading-[1.35]" : "text-[14px] leading-snug",
        className,
      )}
    >
      <tbody>
        {rows.map((r, ri) => {
          const isFirst = ri === 0 && emphasizeFirstRow;
          const isLast = ri === rows.length - 1;
          return (
            <tr
              key={ri}
              className={cn(
                !isFirst && ri % 2 === 1 && "bg-muted/25",
                isFirst && "bg-muted/45",
              )}
            >
              {r.map((c, ci) => (
                <td
                  key={ci}
                  className={cn(
                    "border-b border-border/40 align-top transition-colors",
                    isLast && "border-b-0",
                    compact ? "px-2 py-1.5" : "px-3 py-2.5",
                    isFirst && "pt-2 font-medium text-foreground/95",
                    !isFirst && "text-foreground/90",
                    isLast && "pb-2",
                    compact ? "max-w-[92px]" : "max-w-[min(240px,48vw)]",
                    !compact && "break-words",
                    compact && "truncate",
                  )}
                  title={c || undefined}
                >
                  {c.trim() ? (
                    <span className={cn(compact && "block truncate")}>{c}</span>
                  ) : (
                    <EmptyCell />
                  )}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export const ChatTableGrid = memo(ChatTableGridInner);
