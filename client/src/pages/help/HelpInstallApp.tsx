import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Smartphone } from "lucide-react";
import { HelpPageProse } from "@/features/help/HelpPageProse";
import { PwaInstallButton } from "@/features/help/PwaInstallButton";
import { fetchHelpPage } from "@/lib/help-pages";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { HelpArticleChrome } from "./HelpArticleChrome";
import { ErrorWithRetry } from "@/components/ui/empty";
import { LoadingProgress } from "@/components/ui/loading-progress";

const DEFAULT_TITLE = "Установить PING на экран телефона";
const DEFAULT_BODY = `## Зачем добавлять на экран

Так вы откроете PING как обычное приложение: без адресной строки браузера, с иконкой на рабочем столе и быстрым запуском в один тап.

## iPhone и iPad (Safari)

Система не позволяет установить сайт кнопкой со страницы — только вручную через меню «Поделиться» и пункт «На экран Домой».

## Android (Chrome)

Если ниже есть кнопка установки — используйте её. Иначе откройте меню браузера (⋮) и выберите «Добавить на главный экран» или «Установить приложение».`;

export default function HelpInstallApp() {
  const reduced = usePrefersReducedMotion();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["help-page", "install-app"],
    queryFn: () => fetchHelpPage("install-app"),
  });

  const title = data?.title ?? DEFAULT_TITLE;
  const body = data?.body?.trim() ? data.body : DEFAULT_BODY;

  const fadeProps = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: DURATION_NORMAL_S * 0.85, ease: EASING_OUT_BEZIER },
      };

  if (isLoading && !data) {
    return (
      <HelpArticleChrome title={DEFAULT_TITLE}>
        <LoadingProgress loading minHeight="200px" className="min-h-[200px]">
          <div className="min-h-[200px]" />
        </LoadingProgress>
      </HelpArticleChrome>
    );
  }

  if (isError && !data) {
    return (
      <HelpArticleChrome title={DEFAULT_TITLE}>
        <ErrorWithRetry
          title="Не удалось загрузить текст"
          description={error instanceof Error ? error.message : ""}
          retryLabel="Повторить"
          onRetry={() => void refetch()}
        />
        <div className="mt-4 rounded-2xl border border-border/70 bg-card/80 p-5">
          <HelpPageProse text={DEFAULT_BODY} />
        </div>
      </HelpArticleChrome>
    );
  }

  return (
    <HelpArticleChrome title={title}>
      <div className="space-y-5">
        <motion.div
          {...fadeProps}
          className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/12 via-background to-cyan-500/10 px-5 py-5 shadow-sm"
        >
          <div className="pointer-events-none absolute -left-6 -bottom-10 h-28 w-28 rounded-full bg-cyan-500/15 blur-2xl" />
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Smartphone className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="min-w-0 space-y-3">
              <p className="text-[15px] font-semibold leading-snug text-foreground">
                Прямо с телефона, из браузера — на рабочий стол
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                На iPhone установка только через «Поделиться» → «На экран Домой». На Android часто можно нажать
                кнопку ниже (если браузер предлагает установку) или выбрать то же в меню с тремя точками.
              </p>
              <PwaInstallButton className="w-full rounded-2xl min-h-[var(--uix-touch-min)] sm:w-auto" />
            </div>
          </div>
        </motion.div>

        <motion.div {...fadeProps} className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
          <HelpPageProse text={body} />
        </motion.div>
      </div>
    </HelpArticleChrome>
  );
}
