import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { PageTitle } from "@/components/PageTitle";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  children: React.ReactNode;
  /** Дополнительные классы для области под хедером */
  contentClassName?: string;
};

export function SettingsScreenShell({ title, children, contentClassName }: Props) {
  const [, setLocation] = useLocation();

  return (
    <div className="flex h-full w-full max-w-full min-w-0 overflow-x-hidden justify-center bg-secondary/30">
      <PageTitle title={title} />
      <div className="w-full max-w-full min-w-0 h-full flex flex-col bg-background overflow-y-auto overflow-x-hidden pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))]">
        <header className="uix-content-x py-4 glass z-10 sticky top-0 flex items-center gap-2 border-b border-border/30">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]"
            onClick={() => setLocation("/settings")}
            aria-label="Назад к настройкам"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="uix-text-title font-semibold truncate">{title}</h1>
        </header>
        <div className={contentClassName ?? "p-4 flex flex-col gap-4 flex-1"}>{children}</div>
      </div>
    </div>
  );
}
