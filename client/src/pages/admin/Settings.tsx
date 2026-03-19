import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchFeedAlgorithm,
  updateFeedAlgorithm,
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

  const handleSave = () => {
    if (!feedConfig) return;
    updateMutation.mutate(feedConfig);
  };

  const setConfig = <K extends keyof FeedAlgoConfig>(key: K, value: FeedAlgoConfig[K]) => {
    queryClient.setQueryData<FeedAlgoConfig>(["admin", "feed-algorithm"], (prev) =>
      prev ? { ...prev, [key]: value } : prev
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
    </div>
  );
}
