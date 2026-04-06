import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Props = {
  /** Короткая подпись на кнопке раскрытия, без длинного текста. */
  label: string;
  children: React.ReactNode;
};

/** Вторичные пояснения — по желанию, основной экран остаётся чистым. */
export function MoneyHintBlock({ label, children }: Props) {
  return (
    <Collapsible className="rounded-xl border border-border/50 bg-muted/15">
      <CollapsibleTrigger className="flex w-full min-h-[var(--uix-touch-min)] items-center justify-between gap-2 px-3 py-2.5 text-left uix-text-caption font-medium text-primary">
        <span>{label}</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/40 px-3 py-2">
        <div className="space-y-1.5 uix-text-caption leading-snug text-muted-foreground">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
