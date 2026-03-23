import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { fetchEdgeCompanionCampaignConfig } from "@/lib/edge-gamification";
import { adminSaveEdgeCompanionConfig } from "@/lib/admin-edge-companion";
import { DEFAULT_COMPANION_UI } from "@/features/edge-companion/companion-surfaces/default-ui";
import type { CompanionUiPayload } from "@/features/edge-companion/companion-surfaces/types";

function companionObjectForEditor(ui: CompanionUiPayload) {
  return {
    surfaceOrder: ui.surfaceOrder,
    infoArticle: ui.infoArticle,
    results: ui.results,
    character: ui.character ?? { assetUrl: "", displayName: "" },
  };
}

export default function AdminEdgeCompanion() {
  const { toast } = useToast();
  const [edgeId, setEdgeId] = useState("");
  const [jsonText, setJsonText] = useState(
    JSON.stringify(companionObjectForEditor(DEFAULT_COMPANION_UI), null, 2),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const id = edgeId.trim();
    if (!id) {
      toast({ title: "Введите edgeId", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const cfg = await fetchEdgeCompanionCampaignConfig(id);
      const ui = cfg.companionUi ?? DEFAULT_COMPANION_UI;
      setJsonText(JSON.stringify(companionObjectForEditor(ui), null, 2));
      toast({ title: "Загружено", description: cfg.title });
    } catch (e) {
      toast({
        title: "Ошибка загрузки",
        description: e instanceof Error ? e.message : "Не удалось",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    const id = edgeId.trim();
    if (!id) {
      toast({ title: "Введите edgeId", variant: "destructive" });
      return;
    }
    let companion: unknown;
    try {
      companion = JSON.parse(jsonText) as unknown;
    } catch {
      toast({ title: "Некорректный JSON", variant: "destructive" });
      return;
    }
    if (!companion || typeof companion !== "object" || Array.isArray(companion)) {
      toast({ title: "companion должен быть объектом", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await adminSaveEdgeCompanionConfig(id, companion);
      toast({ title: "Сохранено", description: "config_json.companion обновлён в EDGE" });
    } catch (e) {
      toast({
        title: "Ошибка сохранения",
        description: e instanceof Error ? e.message : "Не удалось",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">EDGE · Companion UI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Редактирование <span className="font-mono text-xs">config_json.companion</span> (порядок экранов,
          статья, статичные итоги). Живые победители подтягиваются из розыгрыша автоматически.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edge-id">edgeId кампании (как в посте)</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="edge-id"
            value={edgeId}
            onChange={(e) => setEdgeId(e.target.value)}
            placeholder="uuid кампании"
            className="min-w-[200px] flex-1 font-mono text-sm"
          />
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Загрузка…" : "Загрузить с EDGE"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="companion-json">JSON объекта companion</Label>
        <Textarea
          id="companion-json"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          className="min-h-[280px] font-mono text-xs leading-relaxed"
          spellCheck={false}
        />
      </div>

      <Button type="button" onClick={() => void save()} disabled={saving}>
        {saving ? "Сохранение…" : "Сохранить в EDGE"}
      </Button>
    </div>
  );
}
