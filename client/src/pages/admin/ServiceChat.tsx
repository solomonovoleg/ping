import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { MessageSquareText, Plus, Send, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchAdminUsers,
  fetchServiceChatState,
  fetchServiceChatTemplates,
  replaceServiceChatTemplate,
  runServiceChatCampaign,
  updateServiceChatHostConfig,
} from "@/lib/admin";

type StepDraft = { content: string; delayAfterReadSec: number; mediaUrls: string };

export default function AdminServiceChat() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [hostUserId, setHostUserId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [globalRepliesAllowed, setGlobalRepliesAllowed] = useState(false);
  const [templateName, setTemplateName] = useState("Приветственная цепочка");
  const [steps, setSteps] = useState<StepDraft[]>([{ content: "", delayAfterReadSec: 0, mediaUrls: "" }]);
  const [campaignMode, setCampaignMode] = useState<"all" | "selected" | "personal">("all");
  const [targetRaw, setTargetRaw] = useState("");
  const [campaignContent, setCampaignContent] = useState("");
  const [campaignMediaUrls, setCampaignMediaUrls] = useState("");

  const stateQuery = useQuery({ queryKey: ["admin", "service-chat", "state"], queryFn: fetchServiceChatState });
  const usersQuery = useQuery({
    queryKey: ["admin", "service-chat", "users"],
    queryFn: () => fetchAdminUsers({ limit: 120, offset: 0 }),
  });
  const templatesQuery = useQuery({
    queryKey: ["admin", "service-chat", "templates", hostUserId],
    queryFn: () => fetchServiceChatTemplates(hostUserId),
    enabled: !!hostUserId,
  });

  useEffect(() => {
    const first = stateQuery.data?.hosts?.[0];
    if (!first || hostUserId) return;
    setHostUserId(first.hostUserId);
    setEnabled(first.enabled);
    setGlobalRepliesAllowed(first.globalRepliesAllowed);
  }, [stateQuery.data?.hosts, hostUserId]);

  useEffect(() => {
    const active = templatesQuery.data?.templates?.find((t) => t.isActive);
    if (!active) return;
    setTemplateName(active.name);
    setSteps(
      active.steps.length > 0
        ? active.steps.map((s) => ({
            content: s.content,
            delayAfterReadSec: s.delayAfterReadSec,
            mediaUrls: (() => {
              if (!s.mediaJson) return "";
              try {
                const parsed = JSON.parse(s.mediaJson) as unknown;
                if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string").join("\n");
                if (typeof parsed === "string") return parsed;
              } catch {
                return s.mediaJson;
              }
              return "";
            })(),
          }))
        : [{ content: "", delayAfterReadSec: 0, mediaUrls: "" }],
    );
  }, [templatesQuery.data?.templates]);

  const selectedTargets = useMemo(
    () => Array.from(new Set(targetRaw.split(/[,\s]+/g).map((s) => s.trim()).filter(Boolean))),
    [targetRaw],
  );

  const hostMutation = useMutation({
    mutationFn: () => updateServiceChatHostConfig({ hostUserId, enabled, globalRepliesAllowed }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "service-chat", "state"] });
      toast({ title: "Хост сохранен" });
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка сохранения", variant: "destructive" }),
  });
  const templateMutation = useMutation({
    mutationFn: () =>
      replaceServiceChatTemplate({
        hostUserId,
        name: templateName,
        steps: steps
          .filter((s) => s.content.trim() || s.mediaUrls.trim())
          .map((s) => ({
            content: s.content,
            delayAfterReadSec: s.delayAfterReadSec,
            mediaJson: s.mediaUrls.trim()
              ? JSON.stringify(s.mediaUrls.split(/\r?\n|,/g).map((x) => x.trim()).filter(Boolean))
              : null,
          })),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "service-chat", "templates", hostUserId] });
      toast({ title: "Шаблон сохранен" });
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка шаблона", variant: "destructive" }),
  });
  const campaignMutation = useMutation({
    mutationFn: () =>
      runServiceChatCampaign({
        hostUserId,
        mode: campaignMode,
        targetUserIds: selectedTargets,
        content: campaignContent,
        mediaJson: campaignMediaUrls.trim()
          ? JSON.stringify(campaignMediaUrls.split(/\r?\n|,/g).map((x) => x.trim()).filter(Boolean))
          : null,
      }),
    onSuccess: (r) =>
      toast({
        title: "Рассылка запущена",
        description: `Целей: ${r.targetCount}, чатов: ${r.affectedThreads}, отправлено: ${r.sentMessagesTo}`,
      }),
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка рассылки", variant: "destructive" }),
  });

  if (stateQuery.isLoading || usersQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Загрузка service-chat...</div>;
  }
  if (stateQuery.isError || usersQuery.isError) {
    return <ErrorWithRetry title="Не удалось загрузить service-chat" description="Проверьте сеть и повторите" onRetry={() => { void stateQuery.refetch(); void usersQuery.refetch(); }} />;
  }
  const users = usersQuery.data?.users ?? [];
  if (users.length === 0) {
    return <ListEmptyState icon={MessageSquareText} title="Нет пользователей" description="Создайте или зарегистрируйте пользователей для выбора хоста" />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Service Chat</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Хост и политика ответов</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Выбрать хоста</Label>
            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={hostUserId} onChange={(e) => setHostUserId(e.target.value)}>
              <option value="">Не выбран</option>
              {users.map((u) => <option key={u.id} value={u.id}>#{u.publicId} {u.displayName || "Без имени"} {u.surname || ""}</option>)}
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Включить авто-цепочки для новых пользователей</label>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={globalRepliesAllowed} onChange={(e) => setGlobalRepliesAllowed(e.target.checked)} /> Глобально разрешить ответы в сервисных чатах</label>
          <div className="flex justify-end"><Button disabled={!hostUserId || hostMutation.isPending} onClick={() => hostMutation.mutate()}>{hostMutation.isPending ? "Сохранение..." : "Сохранить хоста"}</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Шаблон цепочки (after-read)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Название шаблона" />
          {steps.map((s, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2">
              <Label>Шаг {i + 1}</Label>
              <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px]" value={s.content} onChange={(e) => setSteps((prev) => prev.map((x, idx) => idx === i ? { ...x, content: e.target.value } : x))} placeholder="Текст сообщения (можно пусто, если только медиа)" />
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[70px]"
                value={s.mediaUrls}
                onChange={(e) => setSteps((prev) => prev.map((x, idx) => idx === i ? { ...x, mediaUrls: e.target.value } : x))}
                placeholder={"URL медиа (картинка/видео), по одному в строке\nhttps://.../welcome.mp4\nhttps://.../cover.jpg"}
              />
              <div className="flex items-center gap-2">
                <Label className="text-xs">Задержка после прочтения (сек)</Label>
                <Input type="number" min={0} value={s.delayAfterReadSec} onChange={(e) => setSteps((prev) => prev.map((x, idx) => idx === i ? { ...x, delayAfterReadSec: Number(e.target.value) || 0 } : x))} />
                <Button variant="outline" size="icon" disabled={steps.length <= 1} onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Удалить шаг"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={() => setSteps((prev) => [...prev, { content: "", delayAfterReadSec: 0, mediaUrls: "" }])}><Plus className="h-4 w-4 mr-1" />Добавить шаг</Button>
          <div className="flex justify-end"><Button disabled={!hostUserId || templateMutation.isPending} onClick={() => templateMutation.mutate()}>{templateMutation.isPending ? "Сохранение..." : "Сохранить шаблон"}</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Рассылка</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={campaignMode} onChange={(e) => setCampaignMode(e.target.value as "all" | "selected" | "personal")}>
            <option value="all">Всем</option>
            <option value="selected">Выборочно</option>
            <option value="personal">Персонально</option>
          </select>
          {campaignMode !== "all" ? (
            <Input value={targetRaw} onChange={(e) => setTargetRaw(e.target.value)} placeholder="ID пользователей через пробел или запятую" />
          ) : null}
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px]"
            value={campaignContent}
            onChange={(e) => setCampaignContent(e.target.value)}
            placeholder="Текст рассылки (например: Вышло новое обновление...)"
          />
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[70px]"
            value={campaignMediaUrls}
            onChange={(e) => setCampaignMediaUrls(e.target.value)}
            placeholder={"URL медиа для рассылки, по одному в строке\nhttps://.../update.mp4\nhttps://.../banner.jpg"}
          />
          <div className="flex justify-end"><Button disabled={!hostUserId || campaignMutation.isPending} onClick={() => campaignMutation.mutate()}><Send className="h-4 w-4 mr-1" />{campaignMutation.isPending ? "Запуск..." : "Запустить рассылку"}</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
