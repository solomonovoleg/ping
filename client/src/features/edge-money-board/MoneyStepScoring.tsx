import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ALL_MONEY_SCORING_KINDS,
  MONEY_SCORING_UI,
  SINGLE_ACTION_KINDS,
  type MoneyScoringCardState,
} from "@/lib/edge-money-wizard";
import { MoneyHintBlock } from "./MoneyHintBlock";

type Props = {
  cards: MoneyScoringCardState[];
  setCards: React.Dispatch<React.SetStateAction<MoneyScoringCardState[]>>;
};

export function MoneyStepScoring({ cards, setCards }: Props) {
  const update = (kind: MoneyScoringCardState["kind"], patch: Partial<MoneyScoringCardState>) => {
    setCards((prev) => prev.map((c) => (c.kind === kind ? { ...c, ...patch } : c)));
  };

  return (
    <div className="space-y-4">
      <p className="rounded-2xl border border-border/60 bg-card px-3 py-2.5 uix-text-caption leading-snug text-foreground">
        Включите нужные правила. Подробности — под «Подсказка».
      </p>
      <div className="space-y-3">
        {ALL_MONEY_SCORING_KINDS.map((kind) => {
          const c = cards.find((x) => x.kind === kind)!;
          const meta = MONEY_SCORING_UI[kind];
          const isSingle = SINGLE_ACTION_KINDS.has(kind);
          return (
            <div key={kind} className="rounded-2xl border border-border/60 bg-card p-3 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{meta.title}</p>
                  <p className="mt-0.5 uix-text-caption leading-snug text-muted-foreground">{meta.tagline}</p>
                </div>
                <Switch
                  checked={c.enabled}
                  onCheckedChange={(v) => update(kind, { enabled: v })}
                  aria-label={`Включить правило «${meta.title}»`}
                  className="shrink-0"
                />
              </div>
              {c.enabled ? (
                <div className="mt-3 space-y-3">
                  {isSingle ? (
                    <div>
                      <Label className="uix-text-caption text-muted-foreground">{meta.pointsLabel}</Label>
                      <Input
                        type="number"
                        min={0}
                        className="mt-1"
                        value={c.points}
                        onChange={(e) => update(kind, { points: Number(e.target.value) || 0 })}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="uix-text-caption text-muted-foreground">
                          Каждые N {meta.unitShort}
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          className="mt-1"
                          value={c.threshold}
                          onChange={(e) => update(kind, { threshold: Number(e.target.value) || 1 })}
                        />
                      </div>
                      <div>
                        <Label className="uix-text-caption text-muted-foreground">{meta.pointsLabel}</Label>
                        <Input
                          type="number"
                          min={0}
                          className="mt-1"
                          value={c.points}
                          onChange={(e) => update(kind, { points: Number(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  )}
                  <div>
                    <Label className="uix-text-caption text-muted-foreground">
                      Лимит баллов в день (0 = без лимита)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      className="mt-1"
                      value={c.maxPointsPerDay}
                      onChange={(e) =>
                        update(kind, { maxPointsPerDay: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                      }
                    />
                  </div>
                </div>
              ) : null}
              <div className="mt-2">
                <MoneyHintBlock label="Подсказка">
                  {meta.details.map((line) => (
                    <p key={line}>• {line}</p>
                  ))}
                </MoneyHintBlock>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
