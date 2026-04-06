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
import { TapScaleButton } from "@/components/ui/tap-scale";
import { cn } from "@/lib/utils";
import { FileSpreadsheet, Table2 } from "lucide-react";
import { ChatTableGrid } from "./chat-table-grid";

type TablePasteOfferMode = "inline" | "file";

export type TablePasteOfferDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: TablePasteOfferMode;
  cols: number;
  rows: number;
  previewRows: string[][];
  onChoosePlain: () => void;
  onChooseTable: () => void;
};

function TablePasteOfferDialogInner({
  open,
  onOpenChange,
  mode,
  cols,
  rows,
  previewRows,
  onChoosePlain,
  onChooseTable,
}: TablePasteOfferDialogProps) {
  const handleChoosePlain = useCallback(() => {
    onChoosePlain();
  }, [onChoosePlain]);

  const handleChooseTable = useCallback(() => {
    onChooseTable();
  }, [onChooseTable]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="max-w-[min(410px,92vw)] gap-0 overflow-hidden border-border/60 p-0 sm:max-w-md"
        data-chat-detail-keep-menu-open="1"
      >
        <AlertDialogHeader className="space-y-2 border-b border-border/45 bg-gradient-to-r from-sky-500/[0.1] via-transparent to-violet-500/[0.08] px-5 pb-4 pt-5 text-left">
          <AlertDialogTitle className="pr-8 text-lg font-semibold tracking-tight">Оформить как таблицу?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-[13px] leading-snug text-muted-foreground">
              <p>
                Похоже на таблицу{" "}
                <span className="tabular-nums font-medium text-foreground/90">
                  {cols}x{rows}
                </span>
                .
              </p>
              <p>
                {mode === "file"
                  ? "Большой объем: откроем выбор CSV или Excel на следующем шаге."
                  : "Можно вставить как форматированную таблицу прямо в сообщение."}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="px-4 py-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Предпросмотр</p>
          <div className={cn("max-h-[min(180px,34vh)] overflow-auto rounded-xl border border-border/50 bg-muted/20 p-2 dark:bg-muted/12")}>
            <ChatTableGrid rows={previewRows} variant="compact" emphasizeFirstRow />
          </div>
        </div>

        <AlertDialogFooter className="flex flex-col gap-2 border-t border-border/40 bg-muted/10 px-4 py-4 dark:bg-muted/5 sm:flex-row sm:flex-wrap sm:justify-end">
          <AlertDialogCancel type="button" className="mt-0 min-h-[var(--uix-touch-min)] w-full border-border/60 sm:mr-auto sm:w-auto">
            Отмена
          </AlertDialogCancel>
          <TapScaleButton
            type="button"
            haptic
            onClick={handleChoosePlain}
            className="inline-flex min-h-[var(--uix-touch-min)] w-full items-center justify-center rounded-xl border border-border/60 bg-background px-4 text-[13px] font-semibold text-foreground hover:bg-muted/60 sm:w-auto"
            aria-label="Вставить обычным текстом"
          >
            Обычный текст
          </TapScaleButton>
          <TapScaleButton
            type="button"
            haptic
            onClick={handleChooseTable}
            className="inline-flex min-h-[var(--uix-touch-min)] w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-[13px] font-semibold text-white hover:bg-violet-600/90 focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:w-auto"
            aria-label={mode === "file" ? "Продолжить как таблица файлом" : "Вставить как таблицу"}
          >
            {mode === "file" ? <FileSpreadsheet className="h-4 w-4 shrink-0 opacity-95" aria-hidden /> : <Table2 className="h-4 w-4 shrink-0 opacity-95" aria-hidden />}
            {mode === "file" ? "Выбрать CSV / Excel" : "Вставить таблицей"}
          </TapScaleButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const TablePasteOfferDialog = memo(TablePasteOfferDialogInner);
export type { TablePasteOfferMode };
