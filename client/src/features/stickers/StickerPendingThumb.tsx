import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Локальное превью файла; если браузер не рисует HEIC — показываем имя файла. */
export function StickerPendingThumb({
  previewUrl,
  fileName,
  className,
}: {
  previewUrl: string;
  fileName: string;
  className?: string;
}) {
  const [bad, setBad] = useState(false);
  if (bad) {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-0.5 bg-muted/40 px-1 text-center",
          className,
        )}
      >
        <ImageIcon className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden />
        <span className="line-clamp-3 break-all text-[9px] leading-tight text-muted-foreground">{fileName}</span>
      </div>
    );
  }
  return (
    <img src={previewUrl} alt="" className={className} onError={() => setBad(true)} />
  );
}
