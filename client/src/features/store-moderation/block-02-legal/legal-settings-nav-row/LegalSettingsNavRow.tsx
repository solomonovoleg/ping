import type { ReactNode } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { TapScaleA, TapScaleButton } from "@/components/ui/tap-scale";
import { resolveLegalNavigation } from "@/lib/legal-navigation";
import { cn } from "@/lib/utils";

type Props = {
  document: "privacy" | "terms";
  label: string;
  icon: ReactNode;
  iconClass: string;
};

const rowClass =
  "uix-list-row flex w-full items-center justify-between p-3.5 text-left transition-colors duration-75 min-h-[var(--uix-touch-min)] border-0 border-b border-border/50 shadow-none";

/** Строка в настройках: внутри приложения — без Safari, внешний URL — как ссылка. */
export function LegalSettingsNavRow({ document: doc, label, icon, iconClass }: Props) {
  const [, setLocation] = useLocation();
  const nav = resolveLegalNavigation(doc);

  if (nav.mode === "internal") {
    return (
      <TapScaleButton
        type="button"
        subtle
        onClick={() => setLocation(nav.path)}
        className={cn(rowClass, "cursor-pointer rounded-none font-normal hover:bg-secondary/50 text-foreground")}
        aria-label={label}
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white", iconClass)}>{icon}</div>
          <div className="min-w-0 text-left">
            <span className="block text-[16px] font-medium leading-snug">{label}</span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Внутри приложения</span>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/50" aria-hidden />
      </TapScaleButton>
    );
  }

  return (
    <TapScaleA
      href={nav.href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(rowClass, "no-underline text-foreground hover:bg-secondary/50 cursor-pointer")}
      aria-label={`${label} (откроется в браузере)`}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white", iconClass)}>{icon}</div>
        <div className="min-w-0 text-left">
          <span className="block text-[16px] font-medium leading-snug">{label}</span>
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Откроется в браузере</span>
        </div>
      </div>
      <ExternalLink className="h-5 w-5 shrink-0 text-muted-foreground/50" aria-hidden />
    </TapScaleA>
  );
}
