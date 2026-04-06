import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Sticker } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ListEmptyState } from "@/components/ui/empty";
import { fetchMyStickerPacks, fetchStickerPackDetail, searchPublicStickerPacks, type StickerItem } from "@/lib/stickers";
import { resolveUrl } from "@/lib/api-base";
import { triggerLightHaptic } from "@/lib/capacitor-native";
import { cn } from "@/lib/utils";
import { StickerPackCreateDialog } from "./StickerPackCreateDialog";

type StickerPickerPanelProps = {
  onPickSticker: (stickerId: string) => void;
};

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", className)}>{children}</p>
  );
}

export function StickerPickerPanel({ onPickSticker }: StickerPickerPanelProps) {
  const [publicQuery, setPublicQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [expandedPublicPackId, setExpandedPublicPackId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(publicQuery.trim()), 320);
    return () => window.clearTimeout(t);
  }, [publicQuery]);

  const mineQuery = useQuery({
    queryKey: ["sticker-packs", "mine"],
    queryFn: fetchMyStickerPacks,
    staleTime: 60_000,
  });

  const publicSearch = useQuery({
    queryKey: ["sticker-packs", "public", debouncedQ],
    queryFn: () => searchPublicStickerPacks(debouncedQ, 24),
    enabled: debouncedQ.length >= 2,
    staleTime: 30_000,
  });

  const expandedPack = useQuery({
    queryKey: ["sticker-packs", "detail", expandedPublicPackId],
    queryFn: () => fetchStickerPackDetail(expandedPublicPackId!),
    enabled: Boolean(expandedPublicPackId),
  });

  const myFlatStickers = useMemo(() => {
    const packs = mineQuery.data?.packs ?? [];
    const out: { packTitle: string; sticker: StickerItem }[] = [];
    for (const p of packs) {
      for (const s of p.stickers) {
        out.push({ packTitle: p.title, sticker: s });
      }
    }
    return out;
  }, [mineQuery.data?.packs]);

  const handlePick = useCallback(
    (id: string) => {
      triggerLightHaptic();
      onPickSticker(id);
    },
    [onPickSticker],
  );

  const searchActive = debouncedQ.length >= 2;
  const qLen = publicQuery.trim().length;

  const openCreate = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  return (
    <div className="flex max-h-[min(320px,46vh)] flex-col gap-2">
      <p id="sticker-search-hint" className="sr-only">
        Пустое поле показывает ваши стикеры. Для поиска публичных наборов введите не менее двух символов.
      </p>
      <div className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={publicQuery}
            onChange={(e) => setPublicQuery(e.target.value)}
            placeholder="Каталог: от 2 букв…"
            className="h-10 pl-8 text-sm"
            aria-label="Поиск публичных наборов стикеров"
            aria-describedby="sticker-search-hint"
          />
        </div>
        <TapScaleButton
          type="button"
          haptic
          onClick={openCreate}
          className="shrink-0 rounded-xl border border-primary/35 bg-primary/10 px-2.5 text-[11px] font-semibold leading-tight text-primary hover:bg-primary/15"
          aria-label="Создать набор стикеров"
        >
          Создать
        </TapScaleButton>
      </div>
      {qLen === 1 ? (
        <p className="text-[10px] leading-tight text-muted-foreground" aria-live="polite">
          Ещё один символ для поиска в каталоге
        </p>
      ) : null}

      {searchActive ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
          <SectionLabel>Каталог</SectionLabel>
          {publicSearch.isLoading ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : publicSearch.isError ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
              <p className="text-destructive">Не удалось выполнить поиск</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 min-h-[var(--uix-touch-min)]"
                onClick={() => void publicSearch.refetch()}
              >
                Повторить
              </Button>
            </div>
          ) : (publicSearch.data?.packs.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">Ничего не найдено — попробуйте другое название.</p>
          ) : (
            <ul className="space-y-1">
              {publicSearch.data!.packs.map((p) => {
                const expanded = expandedPublicPackId === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      className="flex min-h-[var(--uix-touch-min)] w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setExpandedPublicPackId((cur) => (cur === p.id ? null : p.id))}
                    >
                      <span className="truncate font-medium">{p.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground" aria-hidden>
                        {expanded ? "▼" : "▶"}
                      </span>
                    </button>
                    {expanded && expandedPack.data ? (
                      <div className="grid grid-cols-4 gap-1.5 pb-2 pt-1">
                        {expandedPack.data.stickers.map((s) => (
                          <TapScaleButton
                            key={s.id}
                            type="button"
                            haptic
                            className="flex aspect-square items-center justify-center rounded-lg bg-secondary/40 p-0.5"
                            aria-label="Отправить стикер"
                            onClick={() => handlePick(s.id)}
                          >
                            <img
                              src={resolveUrl(s.imageUrl)}
                              alt=""
                              className="max-h-full max-w-full object-contain"
                              loading="lazy"
                              decoding="async"
                            />
                          </TapScaleButton>
                        ))}
                      </div>
                    ) : null}
                    {expanded && expandedPack.isLoading ? (
                      <div className="flex justify-center py-2">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Загрузка" />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
          <SectionLabel>Мои стикеры</SectionLabel>
          {mineQuery.isLoading ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : mineQuery.isError ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
              <p className="text-destructive">Не удалось загрузить ваши стикеры</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 min-h-[var(--uix-touch-min)]"
                onClick={() => void mineQuery.refetch()}
              >
                Повторить
              </Button>
            </div>
          ) : myFlatStickers.length === 0 ? (
            <ListEmptyState
              className="min-h-[120px] gap-2 border-0 bg-transparent py-3"
              icon={Sticker}
              title="Пока пусто"
              description="Свои — кнопка «Создать». Чужие публичные — введите запрос в поле выше."
              actionLabel="Создать набор"
              onAction={openCreate}
            />
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {myFlatStickers.map(({ packTitle, sticker: s }) => (
                <TapScaleButton
                  key={s.id}
                  type="button"
                  haptic
                  title={packTitle}
                  className="flex aspect-square items-center justify-center rounded-lg bg-secondary/40 p-0.5"
                  aria-label={`Стикер из набора «${packTitle}»`}
                  onClick={() => handlePick(s.id)}
                >
                  <img
                    src={resolveUrl(s.imageUrl)}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                </TapScaleButton>
              ))}
            </div>
          )}
        </div>
      )}

      <StickerPackCreateDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}
