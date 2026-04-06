import { memo, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { FileSpreadsheet, Loader2, Table2 } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { ChatTableGrid } from "./chat-table-grid";

export type LargeTableSendFormat = "csv" | "xlsx";

export type LargeTablePasteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cols: number;
  rows: number;
  previewRows: string[][];
  sendingFormat: LargeTableSendFormat | null;
  onSend: (format: LargeTableSendFormat) => void | Promise<void>;
};

function LargeTablePasteDialogInner({
  open,
  onOpenChange,
  cols,
  rows,
  previewRows,
  sendingFormat,
  onSend,
}: LargeTablePasteDialogProps) {
  const busy = sendingFormat !== null;
  const handleCsv = useCallback(() => {
    void onSend("csv");
  }, [onSend]);
  const handleXlsx = useCallback(() => {
    void onSend("xlsx");
  }, [onSend]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="max-w-[min(400px,92vw)] gap-0 overflow-hidden border-border/60 p-0 sm:max-w-md"
        data-chat-detail-keep-menu-open="1"
      >
        <AlertDialogHeader className="space-y-2 border-b border-border/45 bg-gradient-to-r from-emerald-500/[0.08] via-transparent to-violet-500/[0.07] px-5 pb-4 pt-5 text-left">
          <AlertDialogTitle className="pr-8 text-lg font-semibold tracking-tight">Большая таблица</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-[13px] leading-snug text-muted-foreground">
              <p>
                <span className="font-medium text-foreground/90 tabular-nums">
                  {cols}×{rows}
                </span>
                {" — "}
                не помещается во встроенный вид. Отправить как{" "}
                <span className="text-foreground/85">CSV</span> (универсально) или{" "}
                <span className="text-foreground/85">Excel (.xlsx)</span>?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="px-4 py-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Первые ячейки
          </p>
          <div
            className={cn(
              "max-h-[min(200px,38vh)] overflow-auto rounded-xl border border-border/50 bg-muted/20 p-2 dark:bg-muted/12",
            )}
          >
            <ChatTableGrid rows={previewRows} variant="compact" emphasizeFirstRow />
          </div>
        </div>

        <AlertDialogFooter className="flex flex-col gap-2 border-t border-border/40 bg-muted/10 px-4 py-4 dark:bg-muted/5 sm:flex-row sm:flex-wrap sm:justify-end">
          <AlertDialogCancel
            type="button"
            disabled={busy}
            className="mt-0 min-h-[var(--uix-touch-min)] w-full border-border/60 sm:mr-auto sm:w-auto"
          >
            Отмена
          </AlertDialogCancel>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
            <TapScaleButton
              type="button"
              haptic
              disabled={busy}
              onClick={handleCsv}
              className={cn(
                "inline-flex min-h-[var(--uix-touch-min)] w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-background px-4 text-[13px] font-semibold text-foreground hover:bg-muted/60 sm:w-auto",
                sendingFormat === "csv" && "opacity-80",
              )}
              aria-label="Отправить как CSV"
            >
              {sendingFormat === "csv" ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Table2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              )}
              CSV
            </TapScaleButton>
            <TapScaleButton
              type="button"
              haptic
              disabled={busy}
              onClick={handleXlsx}
              className={cn(
                "inline-flex min-h-[var(--uix-touch-min)] w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-[13px] font-semibold text-white hover:bg-violet-600/90 sm:w-auto",
                "focus-visible:ring-2 focus-visible:ring-violet-500/50",
                sendingFormat === "xlsx" && "opacity-90",
              )}
              aria-label="Отправить как Excel"
            >
              {sendingFormat === "xlsx" ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <FileSpreadsheet className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
              )}
              Excel (.xlsx)
            </TapScaleButton>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const LargeTablePasteDialog = memo(LargeTablePasteDialogInner);
