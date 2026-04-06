import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TapScaleButton } from "@/components/ui/tap-scale";

const VIS: Array<{ v: "self" | "followers" | "public"; short: string; hint: string }> = [
  { v: "public", short: "Все", hint: "Пост с игрой в общей ленте." },
  { v: "followers", short: "Подписчики", hint: "Видят только подписанные на вас." },
  { v: "self", short: "Только я", hint: "Черновик в профиле без показа другим." },
];

type Props = {
  drawSummary: string;
  resetSummary: string;
  endsAt: string;
  displayAudience: "self" | "followers" | "public";
  onDrawSummary: (v: string) => void;
  onResetSummary: (v: string) => void;
  onEndsAt: (v: string) => void;
  onAudience: (v: "self" | "followers" | "public") => void;
};

export function MoneyStepScheduleVisibility({
  drawSummary,
  resetSummary,
  endsAt,
  displayAudience,
  onDrawSummary,
  onResetSummary,
  onEndsAt,
  onAudience,
}: Props) {
  return (
    <div className="space-y-5">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <TapScaleButton
            type="button"
            subtle
            haptic
            className="flex min-h-[var(--uix-touch-min)] w-full items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 uix-text-caption font-medium text-foreground dark:border-amber-400/25"
          >
            <span>Что реально останавливает игру</span>
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform [[data-state=open]_&]:rotate-180" aria-hidden />
          </TapScaleButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <p className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2 uix-text-caption leading-snug text-muted-foreground">
            Строки про «итоги по субботам» — текст для людей. Автоматического розыгрыша по ним нет. Остановка — только
            дата завершения ниже (и статус кампании).
          </p>
        </CollapsibleContent>
      </Collapsible>

      <div>
        <Label htmlFor="m-draw">Подсказка про итоги</Label>
        <Input
          id="m-draw"
          value={drawSummary}
          onChange={(e) => onDrawSummary(e.target.value)}
          placeholder="Например: Итоги — по воскресеньям"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="m-reset">Подсказка про сброс (текст)</Label>
        <Input
          id="m-reset"
          value={resetSummary}
          onChange={(e) => onResetSummary(e.target.value)}
          placeholder="Необязательно"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="m-ends">Дата завершения</Label>
        <Input id="m-ends" type="date" value={endsAt} onChange={(e) => onEndsAt(e.target.value)} className="mt-1.5" />
        <p className="mt-1 uix-text-caption text-muted-foreground">После этой даты действия в кампании блокируются.</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Кто видит пост с игрой</p>
        <div className="flex flex-wrap gap-2">
          {VIS.map(({ v, short, hint }) => (
            <TapScaleButton
              key={v}
              type="button"
              haptic
              subtle
              className={`min-h-[var(--uix-touch-min)] rounded-full border px-4 py-2 text-sm font-medium ${
                displayAudience === v
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/60 bg-secondary/50 text-foreground"
              }`}
              title={hint}
              onClick={() => onAudience(v)}
            >
              {short}
            </TapScaleButton>
          ))}
        </div>
        <p className="uix-text-caption text-muted-foreground">{VIS.find((x) => x.v === displayAudience)?.hint}</p>
      </div>
    </div>
  );
}
