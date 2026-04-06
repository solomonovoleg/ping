import { EDGE_CARD, EDGE_PET_DISPLAY_TITLE } from "@/features/edge-companion/edge-uix";
import { ListEmptyState } from "@/components/ui/empty";
import { Gift } from "lucide-react";

type Props = {
  templates: unknown[];
};

function giftTitle(t: unknown): string {
  if (!t || typeof t !== "object" || Array.isArray(t)) return "Приз";
  const o = t as Record<string, unknown>;
  if (typeof o.title === "string" && o.title.trim()) return o.title.trim();
  if (typeof o.name === "string" && o.name.trim()) return o.name.trim();
  if (typeof o.label === "string" && o.label.trim()) return o.label.trim();
  return "Приз";
}

function giftDescription(t: unknown): string | null {
  if (!t || typeof t !== "object" || Array.isArray(t)) return null;
  const o = t as Record<string, unknown>;
  if (typeof o.description === "string" && o.description.trim()) return o.description.trim();
  if (typeof o.text === "string" && o.text.trim()) return o.text.trim();
  return null;
}

function giftImage(t: unknown): string | null {
  if (!t || typeof t !== "object" || Array.isArray(t)) return null;
  const o = t as Record<string, unknown>;
  if (typeof o.imageUrl === "string" && o.imageUrl.trim()) return o.imageUrl.trim();
  if (typeof o.image === "string" && o.image.trim()) return o.image.trim();
  return null;
}

export function PrizesSurfacePanel({ templates }: Props) {
  if (!templates.length) {
    return (
      <div className="uix-content-x box-border min-h-full pb-[var(--uix-space-6)] pt-[var(--uix-space-2)]">
        <ListEmptyState
          icon={Gift}
          title="Призовой фонд"
          description="Шаблоны призов настраиваются в кампании (gifts_json). Пока список пуст."
          className={`${EDGE_CARD} min-h-[200px]`}
        />
      </div>
    );
  }

  return (
    <section
      className="uix-content-x box-border min-h-full space-y-[var(--uix-space-4)] pb-[var(--uix-space-6)] pt-[var(--uix-space-2)]"
      aria-label="Призы кампании"
    >
      <h2
        className={`${EDGE_PET_DISPLAY_TITLE} rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/12 to-transparent px-4 py-3 dark:from-primary/14`}
      >
        Призы
      </h2>
      <ul className="space-y-[var(--uix-space-3)]">
        {templates.map((t, i) => {
          const img = giftImage(t);
          const desc = giftDescription(t);
          return (
            <li key={i} className={EDGE_CARD}>
              <div className="flex gap-[var(--uix-space-3)]">
                {img ? (
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-primary/20 bg-primary/5">
                    <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Gift className="h-8 w-8" aria-hidden />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{giftTitle(t)}</p>
                  {desc ? (
                    <p className="mt-1 uix-text-caption leading-relaxed text-muted-foreground">{desc}</p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
