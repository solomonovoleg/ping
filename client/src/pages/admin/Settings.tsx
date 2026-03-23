import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchContentIngestState,
  fetchFeedAlgorithm,
  fetchParserUsers,
  runContentIngestNow,
  updateContentIngestConfig,
  updateFeedAlgorithm,
  type ContentIngestState,
  type FeedAlgoConfig,
} from "@/lib/admin";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon } from "lucide-react";

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: feedConfig, isLoading } = useQuery({
    queryKey: ["admin", "feed-algorithm"],
    queryFn: fetchFeedAlgorithm,
  });
  const {
    data: parserState,
    isLoading: parserLoading,
    isError: parserError,
    refetch: refetchParserState,
  } = useQuery({
    queryKey: ["admin", "content-ingest"],
    queryFn: fetchContentIngestState,
  });
  const {
    data: parserUsers,
    isLoading: parserUsersLoading,
    isError: parserUsersError,
    refetch: refetchParserUsers,
  } = useQuery({
    queryKey: ["admin", "content-ingest-users"],
    queryFn: () => fetchParserUsers(),
  });

  const updateMutation = useMutation({
    mutationFn: (patch: Partial<FeedAlgoConfig>) => updateFeedAlgorithm(patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(["admin", "feed-algorithm"], updated);
      toast({ title: "Алгоритм ленты обновлён" });
    },
    onError: (e) => {
      toast({ title: e instanceof Error ? e.message : "Ошибка обновления", variant: "destructive" });
    },
  });
  const updateParserMutation = useMutation({
    mutationFn: (patch: Partial<ContentIngestState["config"]>) => updateContentIngestConfig(patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(["admin", "content-ingest"], updated);
      toast({ title: "Настройки автопостинга сохранены" });
    },
    onError: (e) => {
      toast({ title: e instanceof Error ? e.message : "Ошибка обновления автопостинга", variant: "destructive" });
    },
  });
  const runParserMutation = useMutation({
    mutationFn: () => runContentIngestNow(),
    onSuccess: (result) => {
      queryClient.setQueryData(["admin", "content-ingest"], result.state);
      toast({ title: result.message });
    },
    onError: (e) => {
      toast({ title: e instanceof Error ? e.message : "Ошибка запуска парсера", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!feedConfig) return;
    updateMutation.mutate(feedConfig);
  };

  const setConfig = <K extends keyof FeedAlgoConfig>(key: K, value: FeedAlgoConfig[K]) => {
    queryClient.setQueryData<FeedAlgoConfig>(["admin", "feed-algorithm"], (prev) =>
      prev ? { ...prev, [key]: value } : prev
    );
  };
  const setParserConfig = <K extends keyof ContentIngestState["config"]>(
    key: K,
    value: ContentIngestState["config"][K]
  ) => {
    queryClient.setQueryData<ContentIngestState>(["admin", "content-ingest"], (prev) =>
      prev ? { ...prev, config: { ...prev.config, [key]: value } } : prev
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Настройки</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            Алгоритм ленты
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Параметры ранжирования постов в ленте. Режим chrono_boost_v1 учитывает реакции, комментарии и репосты.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Загрузка…</p>
          ) : !feedConfig ? (
            <p className="text-muted-foreground text-sm">Не удалось загрузить настройки</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Режим</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={feedConfig.mode}
                  onChange={(e) => setConfig("mode", e.target.value as FeedAlgoConfig["mode"])}
                >
                  <option value="strict_chrono">strict_chrono</option>
                  <option value="chrono_boost_v1">chrono_boost_v1</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Окно буста (ч)</Label>
                <Input
                  type="number"
                  value={feedConfig.boostWindowHours}
                  onChange={(e) => setConfig("boostWindowHours", Number(e.target.value) || 12)}
                />
              </div>
              <div className="space-y-2">
                <Label>Реакция (+мин)</Label>
                <Input
                  type="number"
                  value={feedConfig.reactionBoostMinutes}
                  onChange={(e) => setConfig("reactionBoostMinutes", Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Комментарий (+мин)</Label>
                <Input
                  type="number"
                  value={feedConfig.commentBoostMinutes}
                  onChange={(e) => setConfig("commentBoostMinutes", Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Репост (+мин)</Label>
                <Input
                  type="number"
                  value={feedConfig.shareBoostMinutes}
                  onChange={(e) => setConfig("shareBoostMinutes", Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Потолок буста (мин)</Label>
                <Input
                  type="number"
                  value={feedConfig.boostCapMinutes}
                  onChange={(e) => setConfig("boostCapMinutes", Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Новый аккаунт фактор (0..1)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={feedConfig.newAccountFactor}
                  onChange={(e) => setConfig("newAccountFactor", Math.min(1, Math.max(0, Number(e.target.value) || 0)))}
                />
              </div>
              <div className="space-y-2">
                <Label>Очень новый аккаунт (ч)</Label>
                <Input
                  type="number"
                  value={feedConfig.veryNewAccountHours}
                  onChange={(e) => setConfig("veryNewAccountHours", Number(e.target.value) || 24)}
                />
              </div>
              <div className="space-y-2">
                <Label>Новый аккаунт (ч)</Label>
                <Input
                  type="number"
                  value={feedConfig.newAccountHours}
                  onChange={(e) => setConfig("newAccountHours", Number(e.target.value) || 72)}
                />
              </div>
              <div className="space-y-2">
                <Label>Фактор очень нового (0..1)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={feedConfig.veryNewAccountFactor}
                  onChange={(e) => setConfig("veryNewAccountFactor", Math.min(1, Math.max(0, Number(e.target.value) || 0)))}
                />
              </div>
            </div>
          )}
          {feedConfig && (
            <div className="mt-4 flex justify-end">
              <Button
                disabled={updateMutation.isPending}
                onClick={handleSave}
              >
                {updateMutation.isPending ? "Сохранение…" : "Сохранить алгоритм"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            Автопостинг из RSS
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Парсер забирает публикации из открытого RSS, прикрепляет фото (если есть) и публикует от выбранного аккаунта
            по интервалу.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {parserLoading ? (
            <p className="text-muted-foreground text-sm">Загрузка настроек автопостинга…</p>
          ) : parserError || !parserState ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="text-destructive mb-2">Не удалось загрузить настройки автопостинга</p>
              <Button size="sm" variant="outline" onClick={() => refetchParserState()}>
                Повторить
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>RSS URL</Label>
                  <Input
                    value={parserState.config.sourceUrl}
                    onChange={(e) => setParserConfig("sourceUrl", e.target.value)}
                    placeholder="https://news.yandex.ru/index.rss"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Название источника</Label>
                  <Input
                    value={parserState.config.sourceName}
                    onChange={(e) => setParserConfig("sourceName", e.target.value)}
                    placeholder="Yandex News"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Постов за прогон</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={parserState.config.postsPerRun}
                    onChange={(e) => setParserConfig("postsPerRun", Number(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Интервал (мин)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={1440}
                    value={parserState.config.intervalMinutes}
                    onChange={(e) => setParserConfig("intervalMinutes", Number(e.target.value) || 30)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Публиковать от пользователя</Label>
                  {parserUsersLoading ? (
                    <p className="text-muted-foreground text-sm">Загрузка пользователей…</p>
                  ) : parserUsersError ? (
                    <div className="space-y-2">
                      <p className="text-destructive text-sm">Не удалось загрузить список пользователей</p>
                      <Button size="sm" variant="outline" onClick={() => refetchParserUsers()}>
                        Повторить
                      </Button>
                    </div>
                  ) : (
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={parserState.config.authorUserId ?? ""}
                      onChange={(e) => setParserConfig("authorUserId", e.target.value || null)}
                    >
                      <option value="">Не выбран</option>
                      {(parserUsers ?? []).map((u) => (
                        <option key={u.id} value={u.id}>
                          #{u.publicId} {u.displayName || "Без имени"} {u.surname || ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={parserState.config.enabled}
                    onChange={(e) => setParserConfig("enabled", e.target.checked)}
                  />
                  Включить авто-публикацию по интервалу
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={parserState.config.includeImage}
                    onChange={(e) => setParserConfig("includeImage", e.target.checked)}
                  />
                  Публиковать фото из RSS (если есть)
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={parserState.config.onlyWithImage}
                    onChange={(e) => setParserConfig("onlyWithImage", e.target.checked)}
                  />
                  Пропускать новости без фото
                </label>
              </div>

              <div className="rounded-md border p-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Последний запуск:</span>{" "}
                  {parserState.status.lastRunAt ? new Date(parserState.status.lastRunAt).toLocaleString() : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Последний успешный:</span>{" "}
                  {parserState.status.lastSuccessAt ? new Date(parserState.status.lastSuccessAt).toLocaleString() : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Опубликовано / пропущено:</span>{" "}
                  {parserState.status.lastCreated} / {parserState.status.lastSkipped}
                </p>
                {parserState.status.lastError && (
                  <p className="text-destructive">
                    <span className="text-muted-foreground">Последняя ошибка:</span> {parserState.status.lastError}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={runParserMutation.isPending || updateParserMutation.isPending}
                  onClick={() => runParserMutation.mutate()}
                >
                  {runParserMutation.isPending ? "Запуск…" : "Запустить сейчас"}
                </Button>
                <Button
                  disabled={updateParserMutation.isPending}
                  onClick={() => updateParserMutation.mutate(parserState.config)}
                >
                  {updateParserMutation.isPending ? "Сохранение…" : "Сохранить настройки автопостинга"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
