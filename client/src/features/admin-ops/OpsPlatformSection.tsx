import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { fetchMe } from "@/lib/auth";
import { Megaphone } from "lucide-react";
import { adminOpsUi } from "./i18n.ru";
import { fetchOpsPlatform, patchOpsPlatform, type PlatformOpsDto } from "./api";

const QK = ["admin", "ops", "platform"] as const;

export function OpsPlatformSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const canEditPlatform = me?.platformRole === "admin" || me?.platformRole === "super_admin";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QK,
    queryFn: fetchOpsPlatform,
  });

  const mutation = useMutation({
    mutationFn: (payload: PlatformOpsDto) => patchOpsPlatform(payload),
    onSuccess: (r) => {
      qc.setQueryData(QK, {
        bannerEnabled: r.bannerEnabled,
        bannerText: r.bannerText,
        bannerVariant: r.bannerVariant,
        maintenanceMode: r.maintenanceMode,
        strictApiShield: r.strictApiShield,
      });
      qc.invalidateQueries({ queryKey: ["admin", "ops", "traffic-shield"] });
      qc.invalidateQueries({ queryKey: ["platform", "announcement"] });
      toast({ title: r.message ?? adminOpsUi.saved });
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }),
  });

  const setDraft = (partial: Partial<PlatformOpsDto>) => {
    qc.setQueryData<PlatformOpsDto>(QK, (prev) => (prev ? { ...prev, ...partial } : prev));
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  if (error || !data) {
    return (
      <div className="text-sm space-y-2">
        <p className="text-destructive">{adminOpsUi.loadError}</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Megaphone className="w-4 h-4" />
          {adminOpsUi.platformCard}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{adminOpsUi.platformHint}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canEditPlatform ? (
          <p className="text-sm text-muted-foreground rounded-md border border-border bg-muted/30 px-3 py-2">
            Изменение баннера и режима обслуживания доступно только ролям администратор и супер-админ.
          </p>
        ) : null}
        <div className="flex items-center gap-2 min-h-[var(--uix-touch-min)]">
          <Switch
            id="ops-banner-on"
            checked={data.bannerEnabled}
            onCheckedChange={(v) => setDraft({ bannerEnabled: v })}
            disabled={mutation.isPending || !canEditPlatform}
          />
          <Label htmlFor="ops-banner-on">{adminOpsUi.bannerOn}</Label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ops-banner-text">{adminOpsUi.bannerText}</Label>
          <Textarea
            id="ops-banner-text"
            value={data.bannerText}
            onChange={(e) => setDraft({ bannerText: e.target.value })}
            rows={3}
            maxLength={2000}
            disabled={mutation.isPending || !canEditPlatform}
          />
        </div>
        <div className="space-y-2">
          <Label>{adminOpsUi.bannerVariant}</Label>
          <select
            className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={data.bannerVariant}
            onChange={(e) =>
              setDraft({ bannerVariant: e.target.value as PlatformOpsDto["bannerVariant"] })
            }
            disabled={mutation.isPending || !canEditPlatform}
          >
            <option value="info">{adminOpsUi.variantInfo}</option>
            <option value="warning">{adminOpsUi.variantWarning}</option>
            <option value="danger">{adminOpsUi.variantDanger}</option>
          </select>
        </div>
        <div className="flex items-center gap-2 min-h-[var(--uix-touch-min)]">
          <Switch
            id="ops-maint"
            checked={data.maintenanceMode}
            onCheckedChange={(v) => setDraft({ maintenanceMode: v })}
            disabled={mutation.isPending || !canEditPlatform}
          />
          <Label htmlFor="ops-maint">{adminOpsUi.maintenance}</Label>
        </div>
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2 space-y-2">
          <div className="flex items-center gap-2 min-h-[var(--uix-touch-min)]">
            <Switch
              id="ops-strict-shield"
              checked={data.strictApiShield ?? false}
              onCheckedChange={(v) => setDraft({ strictApiShield: v })}
              disabled={mutation.isPending || !canEditPlatform}
            />
            <Label htmlFor="ops-strict-shield">{adminOpsUi.trafficStrictOn}</Label>
          </div>
          <p className="text-xs text-muted-foreground pl-1">{adminOpsUi.trafficStrictHint}</p>
        </div>
        <Button disabled={mutation.isPending || !canEditPlatform} onClick={() => mutation.mutate(data)}>
          {mutation.isPending ? adminOpsUi.saving : adminOpsUi.save}
        </Button>
      </CardContent>
    </Card>
  );
}
