import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StickerPackCreateForm } from "./StickerPackCreateForm";

const DIALOG_Z = "z-[220]";

type StickerPackCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Диалог создания набора стикеров поверх композера чата (z выше плавающей панели эмодзи).
 */
export function StickerPackCreateDialog({ open, onOpenChange }: StickerPackCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-h-[min(90dvh,640px)] w-[min(calc(100vw-1.5rem),400px)] gap-0 overflow-y-auto p-0 sm:rounded-2xl ${DIALOG_Z}`}
        overlayClassName="z-[210] bg-black/70"
        /* iOS/WebKit: нативный выбор фото даёт «клик снаружи» → Radix закрывает диалог и снимает input → нет onChange и превью. */
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="border-b border-border/60 bg-muted/20 px-5 py-4">
          <DialogHeader className="gap-1 space-y-0 text-left">
            <DialogTitle className="text-base font-semibold">Новый набор стикеров</DialogTitle>
            <DialogDescription className="text-xs leading-snug">
              Укажите название и видимость, выберите картинки, проверьте превью и нажмите «Создать набор» — загрузка
              начнётся после этой кнопки.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="px-5 py-4">
          <StickerPackCreateForm
            formKey={open ? "open" : "closed"}
            submitVariant="prominent"
            onSuccess={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
