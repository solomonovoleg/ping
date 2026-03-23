import type { CompanionInfoArticle } from "../types";
import { EDGE_CARD } from "@/features/edge-companion/edge-uix";
import { ListEmptyState } from "@/components/ui/empty";
import { BookOpen } from "lucide-react";

type Props = {
  article: CompanionInfoArticle | null;
  campaignTitle: string;
};

export function InfoArticleSurfacePanel({ article, campaignTitle }: Props) {
  const title = article?.title?.trim() || campaignTitle;

  if (!article?.blocks?.length) {
    return (
      <div className="uix-content-x box-border min-h-full pb-[var(--uix-space-6)] pt-[var(--uix-space-2)]">
        <ListEmptyState
          icon={BookOpen}
          title="Материалы кампании"
          description="Создатель может добавить текст, фото и видео в настройках кампании (config_json.companion.infoArticle)."
          className={`${EDGE_CARD} min-h-[200px]`}
        />
      </div>
    );
  }

  return (
    <article
      className="uix-content-x box-border min-h-full space-y-[var(--uix-space-4)] pb-[var(--uix-space-6)] pt-[var(--uix-space-2)]"
      aria-label={title}
    >
      <header className="px-0.5">
        <h2 className="font-edge-pet text-xl font-semibold leading-tight text-foreground">{title}</h2>
      </header>
      <div className={`${EDGE_CARD} space-y-[var(--uix-space-4)]`}>
        {article.blocks.map((b, i) => {
          if (b.type === "paragraph") {
            return (
              <p
                key={i}
                className="uix-text-list-secondary whitespace-pre-wrap leading-relaxed text-foreground/90"
              >
                {b.text}
              </p>
            );
          }
          if (b.type === "image") {
            return (
              <figure key={i} className="overflow-hidden rounded-2xl border border-border/40 bg-muted/20">
                <img
                  src={b.url}
                  alt={b.alt ?? ""}
                  className="h-auto w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                {b.alt ? (
                  <figcaption className="uix-text-caption px-3 py-2 text-muted-foreground">{b.alt}</figcaption>
                ) : null}
              </figure>
            );
          }
          if (b.type === "video") {
            return (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-border/40 bg-black/90 shadow-inner"
              >
                <video src={b.url} controls playsInline className="aspect-video w-full" preload="metadata" />
              </div>
            );
          }
          return null;
        })}
      </div>
    </article>
  );
}
