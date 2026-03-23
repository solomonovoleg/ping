/**
 * Карточка превью ссылки (og:image, title, description).
 * Если превью недоступно — компактная карточка со ссылкой.
 */
import { useEffect, useState } from "react";
import { ExternalLink, Link2 } from "lucide-react";
import { fetchLinkPreview, type LinkPreview } from "@/lib/link-preview";
import { resolveUrl } from "@/lib/api-base";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LinkPreviewCardProps = {
  url: string;
  className?: string;
};

type CardState =
  | { kind: "loading" }
  | { kind: "rich"; data: LinkPreview }
  | { kind: "fallback" };

function linkCardHost(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./i, "");
  } catch {
    return "Ссылка";
  }
}

function linkCardPathHint(raw: string): string {
  try {
    const u = new URL(raw);
    const path = `${u.pathname}${u.search}`;
    if (!path || path === "/") return u.href;
    return path.length > 52 ? `${path.slice(0, 49)}…` : path;
  } catch {
    return raw.length > 52 ? `${raw.slice(0, 49)}…` : raw;
  }
}

function hasOgContent(p: LinkPreview): boolean {
  return Boolean(p.image || p.title || p.description);
}

const cardShell =
  "mt-1.5 max-w-[240px] rounded-[10px] overflow-hidden border border-border/50 bg-muted/30 dark:bg-white/5 transition-colors";

function LinkPreviewFallback({ url, className }: { url: string; className?: string }) {
  const host = linkCardHost(url);
  const hint = linkCardPathHint(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        cardShell,
        "flex min-h-[var(--uix-touch-min)] items-center gap-2.5 p-2.5 hover:bg-muted/50",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Открыть ссылку: ${host}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-background/60">
        <Link2 className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ссылка</p>
        <p className="truncate text-[13px] font-semibold text-foreground">{host}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-primary" aria-hidden />
    </a>
  );
}

export function LinkPreviewCard({ url, className = "" }: LinkPreviewCardProps) {
  const [state, setState] = useState<CardState>({ kind: "loading" });
  const [ogImageBroken, setOgImageBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    setOgImageBroken(false);
    void fetchLinkPreview(url).then((data) => {
      if (cancelled) return;
      if (data && hasOgContent(data)) {
        setState({ kind: "rich", data });
      } else {
        setState({ kind: "fallback" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (state.kind === "loading") {
    return (
      <div className={cn(cardShell, "space-y-2 p-2.5", className)} aria-busy aria-label="Загрузка превью ссылки">
        <Skeleton className="h-[88px] w-full rounded-md" />
        <Skeleton className="h-3.5 w-[85%] rounded-sm" />
        <Skeleton className="h-3 w-[55%] rounded-sm" />
      </div>
    );
  }

  if (state.kind === "fallback") {
    return <LinkPreviewFallback url={url} className={className} />;
  }

  const preview = state.data;
  const hasText = Boolean(preview.title || preview.description);
  if (preview.image && ogImageBroken && !hasText) {
    return <LinkPreviewFallback url={url} className={className} />;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(cardShell, "block hover:bg-muted/50", className)}
      onClick={(e) => e.stopPropagation()}
    >
      {preview.image && !ogImageBroken ? (
        <img
          src={resolveUrl(preview.image)}
          alt=""
          className="max-h-[140px] w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setOgImageBroken(true)}
        />
      ) : null}
      <div className="p-2">
        {preview.title ? (
          <p className="text-[13px] font-medium text-foreground/90 line-clamp-2">{preview.title}</p>
        ) : null}
        {preview.description ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{preview.description}</p>
        ) : null}
      </div>
    </a>
  );
}
