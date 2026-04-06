import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HelpArticleChrome({
  title,
  children,
  backHref = "/settings",
}: {
  title: string;
  children: ReactNode;
  backHref?: string;
}) {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-[100dvh] w-full bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-background/90 px-3 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full"
          aria-label="Назад"
          onClick={() => setLocation(backHref)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h1>
      </header>
      <div className="mx-auto max-w-lg px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">{children}</div>
    </div>
  );
}
