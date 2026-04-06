import { useQuery } from "@tanstack/react-query";
import { HelpPageProse } from "@/features/help/HelpPageProse";
import { fetchHelpPage } from "@/lib/help-pages";
import { HelpArticleChrome } from "./HelpArticleChrome";
import { ErrorWithRetry } from "@/components/ui/empty";
import { LoadingProgress } from "@/components/ui/loading-progress";

export function HelpGeneric({ slug }: { slug: string }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["help-page", slug],
    queryFn: () => fetchHelpPage(slug),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <HelpArticleChrome title="Справка">
        <LoadingProgress loading minHeight="200px" className="min-h-[200px]">
          <div className="min-h-[200px]" />
        </LoadingProgress>
      </HelpArticleChrome>
    );
  }

  if (isError || !data) {
    return (
      <HelpArticleChrome title="Справка">
        <ErrorWithRetry
          title="Не удалось загрузить"
          description={error instanceof Error ? error.message : "Проверьте сеть"}
          retryLabel="Повторить"
          onRetry={() => void refetch()}
        />
      </HelpArticleChrome>
    );
  }

  return (
    <HelpArticleChrome title={data.title}>
      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
        <HelpPageProse text={data.body} />
      </div>
    </HelpArticleChrome>
  );
}
