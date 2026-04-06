/**
 * Карточка PDF во вложении чата: превью по тапу, скачать — отдельная кнопка (без превью).
 * Также CSV и XLSX (см. `chat-file-payload`).
 */
import { useState, useCallback } from "react";
import { Download, Eye, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { apiFetch, resolveUrl } from "@/lib/api-base";
import { isNative, triggerLightHaptic } from "@/lib/capacitor-native";
import { saveBlobToDevice } from "@/lib/save-media-blob";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TapScaleButton } from "@/components/ui/tap-scale";
import {
  chatAttachmentDownloadFilename,
  chatFileAttachmentKind,
  parseChatFilePayload,
} from "@/features/chat/utils/chat-file-payload";

export { chatFileAttachmentKind, parseChatFilePayload, type ChatFileAttachmentKind } from "@/features/chat/utils/chat-file-payload";

function formatFileSize(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${Math.round(n)} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}

function openExternalUrl(url: string): void {
  if (isNative()) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function ChatPdfAttachment({
  content,
  isMe,
  disabled,
  onOpenPreview,
}: {
  content: string;
  isMe: boolean;
  disabled?: boolean;
  onOpenPreview?: (src: string, fileName: string) => void;
}) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const data = parseChatFilePayload(content);
  if (!data) {
    return <span className="text-sm text-muted-foreground">Файл недоступен</span>;
  }
  const href = resolveUrl(data.url);
  const open = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    triggerLightHaptic();
    if (onOpenPreview) {
      onOpenPreview(href, data.name);
      return;
    }
    openExternalUrl(href);
  };

  const handleDownload = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || downloading) return;
      triggerLightHaptic();
      setDownloading(true);
      try {
        const res = await apiFetch(href);
        if (!res.ok) throw new Error("fetch failed");
        const blob = await res.blob();
        const filename = chatAttachmentDownloadFilename(data.mime, data.name);
        await saveBlobToDevice(blob, { filename, galleryHint: null });
        toast({ title: "Сохранено" });
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        toast({ title: "Не удалось сохранить", variant: "destructive" });
      } finally {
        setDownloading(false);
      }
    },
    [href, data.name, data.mime, disabled, downloading, toast],
  );

  const kind = chatFileAttachmentKind(data.mime, data.name);

  const shell = cn(
    "flex w-full max-w-[min(280px,85vw)] items-stretch overflow-hidden rounded-xl border-2 border-dashed transition-colors",
    kind === "csv"
      ? isMe
        ? "border-emerald-500/45 bg-emerald-500/[0.1] dark:border-emerald-400/45 dark:bg-emerald-500/12"
        : "border-emerald-600/40 bg-emerald-500/[0.07] dark:border-emerald-400/38 dark:bg-emerald-500/10"
      : kind === "xlsx"
        ? isMe
          ? "border-violet-500/45 bg-violet-500/[0.1] dark:border-violet-400/45 dark:bg-violet-500/12"
          : "border-violet-600/40 bg-violet-500/[0.07] dark:border-violet-400/38 dark:bg-violet-500/10"
        : isMe
          ? "border-red-500/40 bg-red-500/[0.12] dark:border-red-400/45 dark:bg-red-500/15"
          : "border-red-600/35 bg-red-500/[0.08] dark:border-red-400/40 dark:bg-red-500/12",
  );

  const openAria =
    kind === "csv"
      ? onOpenPreview
        ? `Просмотр CSV: ${data.name}`
        : `Открыть CSV: ${data.name}`
      : kind === "xlsx"
        ? `Открыть Excel: ${data.name}`
        : onOpenPreview
          ? `Просмотр PDF: ${data.name}`
          : `Открыть PDF: ${data.name}`;

  return (
    <div className={shell}>
      <TapScaleButton
        type="button"
        disabled={disabled}
        onClick={open}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "flex min-h-[var(--uix-touch-min)] min-w-0 flex-1 items-center gap-3 rounded-none border-0 bg-transparent px-3 py-3 text-left shadow-none ring-0 focus-visible:ring-2 focus-visible:ring-primary/40",
        )}
        aria-label={openAria}
      >
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white shadow-sm",
            kind === "csv"
              ? "bg-emerald-600 dark:bg-emerald-500"
              : kind === "xlsx"
                ? "bg-violet-600 dark:bg-violet-500"
                : "bg-red-600 dark:bg-red-500",
          )}
        >
          {kind === "csv" ? (
            <Table2 className="h-6 w-6" aria-hidden />
          ) : kind === "xlsx" ? (
            <FileSpreadsheet className="h-6 w-6" aria-hidden />
          ) : (
            <FileText className="h-6 w-6" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">{data.name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {kind === "csv" ? "Таблица CSV" : kind === "xlsx" ? "Таблица Excel" : "PDF"}
            {data.size > 0 ? ` · ${formatFileSize(data.size)}` : ""}
          </p>
        </div>
        {onOpenPreview && kind === "pdf" ? (
          <Eye className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
      </TapScaleButton>
      <div
        className={cn(
          "w-px shrink-0 self-stretch",
          kind === "csv"
            ? isMe
              ? "bg-emerald-500/35 dark:bg-emerald-400/28"
              : "bg-emerald-600/28 dark:bg-emerald-400/22"
            : kind === "xlsx"
              ? isMe
                ? "bg-violet-500/35 dark:bg-violet-400/28"
                : "bg-violet-600/28 dark:bg-violet-400/22"
              : isMe
                ? "bg-red-500/35 dark:bg-red-400/30"
                : "bg-red-600/30 dark:bg-red-400/25",
        )}
        aria-hidden
      />
      <TapScaleButton
        type="button"
        disabled={disabled || downloading}
        onClick={handleDownload}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] shrink-0 flex-col items-center justify-center rounded-none border-0 bg-transparent px-2 shadow-none ring-0 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50",
        )}
        aria-label={`Скачать ${data.name}`}
      >
        <Download className="h-5 w-5 text-muted-foreground" aria-hidden />
      </TapScaleButton>
    </div>
  );
}
