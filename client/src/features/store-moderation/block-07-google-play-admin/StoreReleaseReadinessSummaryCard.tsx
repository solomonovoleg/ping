import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { AdminPanelCard } from "@/features/admin-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { UX_REVIEW_ROWS } from "../block-06-apple-review-risks/ux-review-rows";
import { PLAY_RELEASE_ROWS } from "./play-release-rows";
import { APPLE_CHECKLIST_STORAGE_KEY, MIN_REVIEW_NOTE_LENGTH, PLAY_CHECKLIST_STORAGE_KEY } from "../readiness-shared";
import { buildChecklistSummary, buildReleaseReadinessSnapshot, readStoredState } from "../readiness-service";

function buildSnapshot() {
  if (typeof window === "undefined") {
    const emptyApple = buildChecklistSummary(UX_REVIEW_ROWS.map((row) => row.key), { completed: [], notesByKey: {} }, MIN_REVIEW_NOTE_LENGTH);
    const emptyPlay = buildChecklistSummary(PLAY_RELEASE_ROWS.map((row) => row.key), { completed: [], notesByKey: {} }, MIN_REVIEW_NOTE_LENGTH);
    return buildReleaseReadinessSnapshot(emptyApple, emptyPlay);
  }
  const appleState = readStoredState(
    APPLE_CHECKLIST_STORAGE_KEY,
    UX_REVIEW_ROWS.map((row) => row.key),
    window.localStorage.getItem(APPLE_CHECKLIST_STORAGE_KEY),
  );
  const playState = readStoredState(
    PLAY_CHECKLIST_STORAGE_KEY,
    PLAY_RELEASE_ROWS.map((row) => row.key),
    window.localStorage.getItem(PLAY_CHECKLIST_STORAGE_KEY),
  );
  const appleSummary = buildChecklistSummary(UX_REVIEW_ROWS.map((row) => row.key), appleState, MIN_REVIEW_NOTE_LENGTH);
  const playSummary = buildChecklistSummary(PLAY_RELEASE_ROWS.map((row) => row.key), playState, MIN_REVIEW_NOTE_LENGTH);
  return buildReleaseReadinessSnapshot(appleSummary, playSummary);
}

export function StoreReleaseReadinessSummaryCard() {
  const [, setLocation] = useLocation();
  const [snapshot, setSnapshot] = useState(() => buildSnapshot());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key !== APPLE_CHECKLIST_STORAGE_KEY && event.key !== PLAY_CHECKLIST_STORAGE_KEY) return;
      setSnapshot(buildSnapshot());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <AdminPanelCard className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Сводка готовности релиза</h2>
        <Button type="button" size="sm" variant="outline" onClick={() => setSnapshot(buildSnapshot())} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Обновить статус
        </Button>
      </div>
      <p className="mt-1 text-sm admin-text-muted">
        Единый контроль готовности Apple + Google Play перед отправкой на ревью.
      </p>

      <div className="mt-4 rounded-xl border border-[hsl(var(--admin-border)/0.45)] bg-[hsl(var(--admin-elevated)/0.2)] p-3">
        <div className="flex items-center justify-between text-xs text-[hsl(210_12%_62%)]">
          <span>Общий прогресс: {snapshot.overallDone}/{snapshot.overallTotal}</span>
          <span>{snapshot.overallPercent}%</span>
        </div>
        <Progress value={snapshot.overallPercent} className="mt-2" aria-label="Общий прогресс готовности релиза" />
        <p className={cn("mt-2 text-xs", snapshot.overallReady ? "text-emerald-300" : "text-[hsl(210_12%_62%)]")}>
          {snapshot.overallReady
            ? "Готово к отправке: Apple и Google Play чеклисты закрыты."
            : "Не готово: завершите оба чеклиста и добавьте подтверждения."}
        </p>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[hsl(var(--admin-border)/0.4)] bg-[hsl(var(--admin-elevated)/0.2)] p-3">
          <p className="font-medium text-[hsl(210_20%_96%)]">Apple pre-submit gate</p>
          <p className="mt-1 text-xs text-[hsl(210_12%_62%)]">
            {snapshot.appleSummary.done}/{snapshot.appleSummary.total} ({snapshot.appleSummary.percent}%)
          </p>
          <Progress value={snapshot.appleSummary.percent} className="mt-2" aria-label="Прогресс Apple UX" />
          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setLocation("/admin/store-review-risks")}>
            Открыть Apple-риски
          </Button>
        </div>
        <div className="rounded-xl border border-[hsl(var(--admin-border)/0.4)] bg-[hsl(var(--admin-elevated)/0.2)] p-3">
          <p className="font-medium text-[hsl(210_20%_96%)]">Готовность Google Play</p>
          <p className="mt-1 text-xs text-[hsl(210_12%_62%)]">
            {snapshot.playSummary.done}/{snapshot.playSummary.total} ({snapshot.playSummary.percent}%)
          </p>
          <Progress value={snapshot.playSummary.percent} className="mt-2" aria-label="Прогресс готовности Google Play" />
          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setLocation("/admin/store-review-play")}>
            Открыть Google Play-чеклист
          </Button>
        </div>
      </div>
    </AdminPanelCard>
  );
}
