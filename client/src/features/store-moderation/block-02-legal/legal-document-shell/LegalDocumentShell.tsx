import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getPrivacyPolicyUrl, getTermsOfUseUrl } from "@/lib/legal";
import { cn } from "@/lib/utils";

type Props = {
  /** Заголовок в шапке экрана */
  heading: string;
  /** Полный заголовок вкладки (App Store / ревьюер откроет в браузере) */
  documentTitle: string;
  /** Краткое описание для meta description (сниппет в поиске и при шаринге) */
  metaDescription?: string;
  /** Публичный URL для кнопки «Скопировать ссылку» (как в Connect / Play) */
  publicUrlDocument?: "privacy" | "terms";
  children: ReactNode;
  /** Куда вести, если истории нет */
  backFallbackPath?: string;
};

export function LegalDocumentShell({
  heading,
  documentTitle,
  metaDescription,
  publicUrlDocument,
  children,
  backFallbackPath = "/login",
}: Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [urlCopied, setUrlCopied] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = documentTitle;
    return () => {
      document.title = prev;
    };
  }, [documentTitle]);

  useEffect(() => {
    if (!metaDescription) return;
    const el = document.querySelector('meta[name="description"]');
    if (!(el instanceof HTMLMetaElement)) return;
    const prev = el.content;
    el.content = metaDescription;
    return () => {
      el.content = prev;
    };
  }, [metaDescription]);

  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash) return;
    window.scrollTo(0, 0);
  }, []);

  const publicUrl =
    publicUrlDocument === "privacy"
      ? getPrivacyPolicyUrl()
      : publicUrlDocument === "terms"
        ? getTermsOfUseUrl()
        : null;

  const copyPublicUrl = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setUrlCopied(true);
      toast({ title: "Ссылка скопирована", description: "Вставьте в письмо поддержки или в консоль стора.", duration: 2500 });
      window.setTimeout(() => setUrlCopied(false), 2000);
    } catch {
      toast({ title: "Не удалось скопировать", variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto h-[100dvh] w-full max-w-2xl overflow-y-auto bg-background pb-safe pt-safe print:h-auto print:min-h-0 print:overflow-visible print:pb-0 print:pt-0">
      <a
        href="#legal-document-main"
        className={cn(
          "sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-20",
          "focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
        )}
      >
        К содержанию
      </a>
      <header className="sticky top-0 z-10 flex min-h-[var(--uix-touch-min)] flex-wrap items-center gap-2 border-b border-border/50 bg-background/95 py-3 backdrop-blur uix-content-x print:static print:break-inside-avoid print:border-border print:bg-background">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => (window.history.length > 1 ? window.history.back() : setLocation(backFallbackPath))}
          className="shrink-0 print:hidden"
          aria-label="Назад"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Button>
        <h1 className="min-w-0 flex-1 text-lg font-semibold leading-tight print:text-xl">{heading}</h1>
        {publicUrl ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto h-9 min-h-[var(--uix-touch-min)] shrink-0 gap-1.5 border-border/70 px-3 text-xs font-medium print:hidden sm:min-h-9"
            onClick={() => void copyPublicUrl()}
            aria-label="Скопировать публичную ссылку на документ"
          >
            {urlCopied ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : <Link2 className="h-4 w-4 shrink-0" aria-hidden />}
            {urlCopied ? (
              "Готово"
            ) : (
              <>
                <span className="sm:hidden">URL</span>
                <span className="hidden sm:inline">Копировать URL</span>
              </>
            )}
          </Button>
        ) : null}
      </header>
      <main id="legal-document-main" tabIndex={-1} className="uix-content-x py-4 pb-10 outline-none print:py-6">
        <article className="max-w-none text-[15px] leading-relaxed text-foreground print:text-[14pt] print:leading-normal">
          {children}
        </article>
        {publicUrl ? (
          <p className="mt-8 hidden border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground print:block">
            Полный адрес для стора и поддержки: <span className="break-all font-mono text-foreground">{publicUrl}</span>
          </p>
        ) : null}
      </main>
    </div>
  );
}
