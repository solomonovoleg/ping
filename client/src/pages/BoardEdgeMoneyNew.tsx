import { ChevronLeft, Loader2 } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorWithRetry } from "@/components/ui/empty";
import { MONEY_WIZARD_STEPS } from "@/lib/edge-money-wizard";
import { useBoardEdgeMoneyWizard } from "@/features/edge-money-board/use-board-edge-money-wizard";
import { MoneyStepPresentation } from "@/features/edge-money-board/MoneyStepPresentation";
import { MoneyStepScoring } from "@/features/edge-money-board/MoneyStepScoring";
import { MoneyStepTiers } from "@/features/edge-money-board/MoneyStepTiers";
import { MoneyStepLeaderboards } from "@/features/edge-money-board/MoneyStepLeaderboards";
import { MoneyStepScheduleVisibility } from "@/features/edge-money-board/MoneyStepScheduleVisibility";
import { MoneyStepDone } from "@/features/edge-money-board/MoneyStepDone";
import { MoneyInviteDmFields } from "@/features/edge-money-board/invite-dm-fields/MoneyInviteDmFields";

export default function BoardEdgeMoneyNew() {
  const w = useBoardEdgeMoneyWizard();

  if (w.edgeIdParam && w.detailQ.isError) {
    return (
      <div className="flex h-full flex-col bg-background">
        <header className="glass sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 uix-content-x pt-6 pb-4">
          <TapScaleButton
            type="button"
            onClick={() => w.setLocation("/board/edge")}
            haptic
            subtle
            className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 -ml-2 hover:bg-secondary"
            aria-label="Назад"
          >
            <ChevronLeft className="h-6 w-6" />
          </TapScaleButton>
          <h1 className="uix-text-title">EDGE MONEY</h1>
        </header>
        <div className="uix-content-x flex-1 py-6">
          <ErrorWithRetry
            title="Не удалось загрузить"
            description={w.detailQ.error instanceof Error ? w.detailQ.error.message : "Повторите"}
            onRetry={() => void w.detailQ.refetch()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full max-w-full min-w-0 flex-col overflow-hidden bg-background">
      <header className="glass sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 uix-content-x pt-6 pb-4">
        <TapScaleButton
          type="button"
          onClick={() => w.setLocation("/board/edge")}
          haptic
          subtle
          className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 -ml-2 hover:bg-secondary"
          aria-label="Назад"
        >
          <ChevronLeft className="h-6 w-6" />
        </TapScaleButton>
        <h1 className="uix-text-title min-w-0 flex-1 truncate">EDGE MONEY</h1>
      </header>

      <div className="border-b border-border/30 uix-content-x py-2">
        <p className="uix-text-caption text-muted-foreground">
          Шаг {w.step + 1}/{MONEY_WIZARD_STEPS.length}:{" "}
          <span className="font-medium text-foreground">{w.stepLabel}</span>
        </p>
        {w.edgeIdParam ? (
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground break-all">{w.edgeIdParam}</p>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto uix-content-x py-4 pb-[calc(var(--uix-nav-bottom)+var(--uix-space-6))]">
        {w.edgeIdParam && w.detailQ.isLoading && !w.detailQ.data ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : null}

        {!w.edgeIdParam && w.step === 0 ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-3 py-3 uix-text-caption leading-snug">
              <strong>EDGE MONEY</strong> — рейтинг и призы за действия в Пинге. Персонаж не нужен. Подсказки — в
              раскрывающихся блоках, без длинных текстов на экране.
            </div>
            <div>
              <Label htmlFor="m-title">Название (для себя)</Label>
              <Input
                id="m-title"
                value={w.campaignTitle}
                onChange={(e) => w.setCampaignTitle(e.target.value)}
                placeholder="Весенний кэшбек"
                className="mt-1.5"
                maxLength={200}
              />
            </div>
          </div>
        ) : null}

        {w.edgeIdParam && w.step === 1 ? (
          <MoneyStepPresentation
            headline={w.headline}
            mediaUrl={w.mediaUrl}
            colorScheme={w.colorScheme}
            onHeadline={w.setHeadline}
            onMediaUrl={w.setMediaUrl}
            onColorScheme={w.setColorScheme}
          />
        ) : null}
        {w.edgeIdParam && w.step === 2 ? (
          <div className="space-y-4">
            <MoneyStepScoring cards={w.cards} setCards={w.setCards} />
            {w.cards.find((c) => c.kind === "invite_friend")?.enabled ? (
              <MoneyInviteDmFields
                template={w.inviteDmTemplate}
                codeExpiresInHours={w.inviteDmHours}
                onTemplate={w.setInviteDmTemplate}
                onCodeExpiresInHours={w.setInviteDmHours}
              />
            ) : null}
          </div>
        ) : null}
        {w.edgeIdParam && w.step === 3 ? <MoneyStepTiers tiers={w.tiers} setTiers={w.setTiers} /> : null}
        {w.edgeIdParam && w.step === 4 ? (
          <MoneyStepLeaderboards
            leaderboardPrimaryEnabled={w.leaderboardPrimaryEnabled}
            leaderboardSecondaryEnabled={w.leaderboardSecondaryEnabled}
            onPrimary={w.setLeaderboardPrimaryEnabled}
            onSecondary={w.setLeaderboardSecondaryEnabled}
          />
        ) : null}
        {w.edgeIdParam && w.step === 5 ? (
          <MoneyStepScheduleVisibility
            drawSummary={w.drawSummary}
            resetSummary={w.resetSummary}
            endsAt={w.endsAt}
            displayAudience={w.displayAudience}
            onDrawSummary={w.setDrawSummary}
            onResetSummary={w.setResetSummary}
            onEndsAt={w.setEndsAt}
            onAudience={w.setDisplayAudience}
          />
        ) : null}
        {w.edgeIdParam && w.step === 6 ? (
          <MoneyStepDone
            edgeId={w.edgeIdParam}
            publishing={w.publishMut.isPending}
            onPublish={() => w.publishMut.mutate()}
            onOpenManage={() => w.setLocation("/board/edge/manage")}
            onCreatePost={() => w.setLocation(`/create-post?edgeId=${encodeURIComponent(w.edgeIdParam)}`)}
          />
        ) : null}
      </div>

      {w.step < MONEY_WIZARD_STEPS.length - 1 ? (
        <div className="glass sticky bottom-0 border-t border-border/40 uix-content-x py-3 pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))]">
          <div className="flex gap-2">
            {w.step > 0 ? (
              <TapScaleButton
                type="button"
                haptic
                subtle
                className="min-h-[var(--uix-touch-min)] flex-1 rounded-2xl border border-border py-3 font-medium"
                disabled={w.isBusy}
                onClick={() => w.setStep((s) => Math.max(0, s - 1))}
              >
                Назад
              </TapScaleButton>
            ) : null}
            <TapScaleButton
              type="button"
              haptic
              className="min-h-[var(--uix-touch-min)] flex-[2] rounded-2xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60"
              disabled={w.isBusy}
              onClick={() => void w.goNext()}
            >
              {w.step === 0 ? (
                w.createMut.isPending ? (
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                ) : (
                  "Создать черновик"
                )
              ) : (
                "Далее"
              )}
            </TapScaleButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
