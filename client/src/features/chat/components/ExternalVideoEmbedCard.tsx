import { useMemo, useState } from "react";
import { Play, ExternalLink } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { cn } from "@/lib/utils";
import { externalVideoProviderLabel, parseExternalVideoUrl } from "@/lib/external-video";

type ExternalVideoEmbedCardProps = {
  url: string;
  className?: string;
};

export function ExternalVideoEmbedCard({ url, className = "" }: ExternalVideoEmbedCardProps) {
  const video = useMemo(() => parseExternalVideoUrl(url), [url]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  if (!video) return null;

  const label = externalVideoProviderLabel(video.provider);
  const canEmbed = Boolean(video.embedUrl);

  return (
    <div
      className={cn(
        "mt-1.5 max-w-[240px] rounded-[10px] overflow-hidden border border-border/50 bg-muted/30 dark:bg-white/5",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {!isOpen || !canEmbed ? (
        <div className="p-2.5">
          <p className="text-[11px] text-muted-foreground mb-1.5">{label}</p>
          {canEmbed ? (
            <TapScaleButton
              type="button"
              onClick={() => setIsOpen(true)}
              className="min-h-[var(--uix-touch-min)] w-full rounded-lg bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-1.5"
              aria-label={`Смотреть видео ${label} в чате`}
            >
              <Play className="w-4 h-4" aria-hidden />
              Смотреть в чате
            </TapScaleButton>
          ) : (
            <TapScaleButton
              type="button"
              onClick={() => window.open(video.watchUrl, "_blank", "noopener,noreferrer")}
              className="min-h-[var(--uix-touch-min)] w-full rounded-lg bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-1.5"
              aria-label={`Открыть ${label}`}
            >
              <ExternalLink className="w-4 h-4" aria-hidden />
              Открыть в {label}
            </TapScaleButton>
          )}
        </div>
      ) : (
        <div className="relative">
          {!isLoaded && (
            <div className="absolute inset-0 bg-muted/70 animate-pulse" aria-hidden />
          )}
          <iframe
            src={video.embedUrl}
            className="block w-full aspect-video bg-black"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
            title={`Видео ${label}`}
            onLoad={() => setIsLoaded(true)}
          />
        </div>
      )}
      <a
        href={video.watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 px-2 py-2 text-xs text-primary hover:underline"
      >
        <ExternalLink className="w-3.5 h-3.5" aria-hidden />
        Открыть во внешнем окне
      </a>
    </div>
  );
}
