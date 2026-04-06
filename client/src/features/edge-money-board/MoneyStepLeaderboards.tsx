import { Switch } from "@/components/ui/switch";
import { MoneyHintBlock } from "./MoneyHintBlock";

type Props = {
  leaderboardPrimaryEnabled: boolean;
  leaderboardSecondaryEnabled: boolean;
  onPrimary: (v: boolean) => void;
  onSecondary: (v: boolean) => void;
};

export function MoneyStepLeaderboards({
  leaderboardPrimaryEnabled,
  leaderboardSecondaryEnabled,
  onPrimary,
  onSecondary,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card px-3 py-2.5 uix-text-caption leading-snug text-foreground">
        Баллы с шага «Баллы» идут в <strong>дополнительный</strong> рейтинг. Оставьте его включённым. Основной — опция
        «на будущее», обычно выкл.
      </div>
      <div className="flex items-start justify-between gap-3 rounded-2xl border border-border/50 bg-muted/10 px-3 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Дополнительный рейтинг</p>
          <p className="mt-0.5 uix-text-caption text-muted-foreground">Сюда копятся очки за задания.</p>
        </div>
        <Switch checked={leaderboardSecondaryEnabled} onCheckedChange={onSecondary} aria-label="Дополнительный рейтинг" />
      </div>
      <div className="flex items-start justify-between gap-3 rounded-2xl border border-border/50 bg-muted/10 px-3 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Основной рейтинг</p>
          <p className="mt-0.5 uix-text-caption text-muted-foreground">Для персонажа; в MONEY не обязателен.</p>
        </div>
        <Switch
          checked={leaderboardPrimaryEnabled}
          onCheckedChange={(v) => {
            onPrimary(v);
            if (!v && !leaderboardSecondaryEnabled) onSecondary(true);
          }}
          aria-label="Основной рейтинг"
        />
      </div>
      <MoneyHintBlock label="Почему два переключателя">
        <p>В продукте два независимых столбца очков. Для денежной игры достаточно одного включённого — дополнительного.</p>
      </MoneyHintBlock>
    </div>
  );
}
