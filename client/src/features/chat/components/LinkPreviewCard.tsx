/**
 * Карточка превью ссылки (og:image, title, description).
 */
import { useEffect, useState } from "react";
import { fetchLinkPreview, type LinkPreview } from "@/lib/link-preview";
import { resolveUrl } from "@/lib/api-base";

type LinkPreviewCardProps = {
  url: string;
  className?: string;
};

export function LinkPreviewCard({ url, className = "" }: LinkPreviewCardProps) {
  const [preview, setPreview] = useState<LinkPreview | null | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    fetchLinkPreview(url).then((data) => {
      if (!cancelled) setPreview(data);
    });
    return () => { cancelled = true; };
  }, [url]);

  if (preview === "loading" || !preview) return null;
  if (!preview.image && !preview.title && !preview.description) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block max-w-[240px] rounded-[10px] overflow-hidden border border-border/50 bg-muted/30 dark:bg-white/5 hover:bg-muted/50 transition-colors mt-1.5 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {preview.image && (
        <img
          src={resolveUrl(preview.image)}
          alt=""
          className="w-full max-h-[140px] object-cover"
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="p-2">
        {preview.title && (
          <p className="text-[13px] font-medium line-clamp-2 text-foreground/90">{preview.title}</p>
        )}
        {preview.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{preview.description}</p>
        )}
      </div>
    </a>
  );
}
