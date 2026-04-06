import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SettingsScreenShell } from "@/features/settings/components/SettingsScreenShell";
import { StickerPackSettingsCard } from "@/features/stickers/StickerPackSettingsCard";
import { StickerPackCreateForm } from "@/features/stickers/StickerPackCreateForm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMyStickerPacks } from "@/lib/stickers";

export default function SettingsStickers() {
  const qc = useQueryClient();

  const packsQuery = useQuery({
    queryKey: ["sticker-packs", "mine"],
    queryFn: fetchMyStickerPacks,
  });

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["sticker-packs", "mine"] });
  }, [qc]);

  return (
    <SettingsScreenShell title="Стикеры">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Подойдут JPEG, PNG, WebP, GIF и фото с iPhone (HEIC). На сервере всё приводится к WebP до 512 px. Личный набор
        видите только вы; публичный — в поиске в чате. После создания: чат → смайлик → «Стикеры».
      </p>

      <section className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-4">
        <h2 className="text-sm font-semibold tracking-tight">Новый набор</h2>
        <StickerPackCreateForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">Мои наборы</h2>
        {packsQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : packsQuery.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="text-destructive">Не удалось загрузить наборы</p>
            <Button type="button" variant="outline" size="sm" className="mt-2 min-h-[var(--uix-touch-min)]" onClick={() => void packsQuery.refetch()}>
              Повторить
            </Button>
          </div>
        ) : (packsQuery.data?.packs.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет наборов — создайте первый выше.</p>
        ) : (
          <ul className="space-y-4">
            {packsQuery.data!.packs.map((pack) => (
              <StickerPackSettingsCard key={pack.id} pack={pack} onChanged={invalidate} />
            ))}
          </ul>
        )}
      </section>
    </SettingsScreenShell>
  );
}
