import { Plus, Trash2 } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type MoneyTierFormRow, newLocalId } from "@/lib/edge-money-wizard";
import { MoneyHintBlock } from "./MoneyHintBlock";

type Props = {
  tiers: MoneyTierFormRow[];
  setTiers: React.Dispatch<React.SetStateAction<MoneyTierFormRow[]>>;
};

export function MoneyStepTiers({ tiers, setTiers }: Props) {
  const add = () => {
    setTiers((t) => [
      ...t,
      { localId: newLocalId(), id: `tier_${t.length + 1}`, fromRank: 1, toRank: 1, label: "" },
    ]);
  };
  const remove = (localId: string) => setTiers((t) => t.filter((x) => x.localId !== localId));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card px-3 py-2.5 uix-text-caption leading-snug text-foreground">
        Несколько ступеней: например <strong>1 место</strong> — одна сумма, <strong>8–10</strong> — другая. Можно
        добавить сколько угодно строк.
      </div>
      <MoneyHintBlock label="Как это связано с выплатами">
        <p>Тексты вроде «5000 ₽» — для игроков и для вас. Фактические переводы вы делаете вне приложения; здесь мы
          фиксируем обещание и места в рейтинге.</p>
      </MoneyHintBlock>
      <div className="space-y-3">
        {tiers.map((row) => (
          <div key={row.localId} className="rounded-2xl border border-border/50 bg-muted/10 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Диапазон мест</span>
              <TapScaleButton
                type="button"
                haptic
                subtle
                className="inline-flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 text-destructive hover:bg-destructive/10"
                aria-label="Удалить строку"
                onClick={() => remove(row.localId)}
              >
                <Trash2 className="h-4 w-4" />
              </TapScaleButton>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">С места</Label>
                <Input
                  type="number"
                  min={1}
                  className="mt-1"
                  value={row.fromRank}
                  onChange={(e) =>
                    setTiers((t) =>
                      t.map((x) =>
                        x.localId === row.localId ? { ...x, fromRank: Number(e.target.value) || 1 } : x,
                      ),
                    )
                  }
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">По место</Label>
                <Input
                  type="number"
                  min={1}
                  className="mt-1"
                  value={row.toRank}
                  onChange={(e) =>
                    setTiers((t) =>
                      t.map((x) =>
                        x.localId === row.localId ? { ...x, toRank: Number(e.target.value) || 1 } : x,
                      ),
                    )
                  }
                />
              </div>
            </div>
            <div className="mt-2">
              <Label className="text-[11px] text-muted-foreground">Приз (коротко)</Label>
              <Input
                className="mt-1"
                value={row.label}
                onChange={(e) =>
                  setTiers((t) =>
                    t.map((x) => (x.localId === row.localId ? { ...x, label: e.target.value } : x)),
                  )
                }
                placeholder="5000 ₽"
                maxLength={200}
              />
            </div>
          </div>
        ))}
      </div>
      <TapScaleButton
        type="button"
        haptic
        className="flex min-h-[var(--uix-touch-min)] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 py-3 text-sm font-medium text-primary"
        onClick={add}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Добавить ступень
      </TapScaleButton>
    </div>
  );
}
