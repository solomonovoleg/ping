import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AdminPageHeader, AdminPanelCard, adminPageStackClass } from "@/features/admin-shell";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createAdminReferralCode,
  fetchAdminReferralCodes,
  fetchAdminInviteMoreRequests,
  fetchAdminReferralProgramSettings,
  patchAdminReferralProgramSettings,
  patchAdminInviteMoreRequest,
  type AdminInviteMoreRequestRow,
  type AdminReferralCode,
  type AdminReferralProgramSettings,
} from "@/lib/admin";
import { useToast } from "@/hooks/use-toast";
import { formatDateWithYearLocal } from "@/lib/timezone";
import { Copy, Inbox, Ticket } from "lucide-react";

const DEFAULT_EXPIRES_HOURS = 7 * 24; // fallback на клиенте
const ADMIN_NOTE_MAX = 500;

function usesLabel(maxUses?: number, useCount?: number): string {
  if (maxUses === -1) return `многоразовый · уже ${useCount ?? 0}`;
  if (maxUses != null && maxUses > 1) return `${useCount ?? 0} / ${maxUses} регистраций`;
  return "одноразовый";
}

export default function AdminReferrals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [multiUseUnlimited, setMultiUseUnlimited] = useState(false);
  const [cappedUses, setCappedUses] = useState("");
  const [codeNote, setCodeNote] = useState("");
  const [settingsDraft, setSettingsDraft] = useState<AdminReferralProgramSettings>({
    defaultInvites: 3,
    repeatEnabled: false,
    repeatInvites: 5,
    repeatAfterHours: 72,
    multiUseDefaultExpiresHours: 7 * 24,
  });

  const { data: codes = [], isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "referrals"],
    queryFn: fetchAdminReferralCodes,
  });

  const { data: inviteMoreList = [], isLoading: inviteMoreLoading, error: inviteMoreError, refetch: refetchInviteMore } = useQuery({
    queryKey: ["admin", "invite-more-requests"],
    queryFn: fetchAdminInviteMoreRequests,
  });
  const { data: referralSettings, isLoading: settingsLoading, error: settingsError, refetch: refetchSettings } = useQuery({
    queryKey: ["admin", "referrals-program-settings"],
    queryFn: fetchAdminReferralProgramSettings,
  });

  useEffect(() => {
    if (!referralSettings) return;
    setSettingsDraft(referralSettings);
  }, [referralSettings]);
  const settingsMut = useMutation({
    mutationFn: () => patchAdminReferralProgramSettings(settingsDraft),
    onSuccess: (next) => {
      queryClient.setQueryData(["admin", "referrals-program-settings"], next);
      setSettingsDraft(next);
      toast({ title: "Настройки приглашений сохранены" });
    },
    onError: (e) => {
      toast({ title: e instanceof Error ? e.message : "Ошибка сохранения", variant: "destructive" });
    },
  });


  const inviteMoreMut = useMutation({
    mutationFn: (args: { id: string; action: "approve" | "reject"; bonusInvites?: number }) =>
      patchAdminInviteMoreRequest(args.id, {
        action: args.action,
        bonusInvites: args.bonusInvites,
      }),
    onSuccess: (_d, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "invite-more-requests"] });
      toast({
        title: vars.action === "approve" ? "Лимит приглашений увеличен" : "Заявка отклонена",
      });
    },
    onError: (e) => {
      toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const parsed = parseInt(cappedUses.trim(), 10);
      const maxUses =
        !multiUseUnlimited && Number.isFinite(parsed) && parsed > 1
          ? Math.min(parsed, 10_000)
          : undefined;
      const noteTrim = codeNote.trim();
      const expiresInHours = multiUseUnlimited
        ? Math.max(1, referralSettings?.multiUseDefaultExpiresHours ?? DEFAULT_EXPIRES_HOURS)
        : DEFAULT_EXPIRES_HOURS;
      return createAdminReferralCode({
        expiresInHours,
        multiUse: multiUseUnlimited ? true : undefined,
        maxUses,
        adminNote: noteTrim ? noteTrim.slice(0, ADMIN_NOTE_MAX) : undefined,
      });
    },
    onSuccess: (created) => {
      queryClient.setQueryData<AdminReferralCode[]>(["admin", "referrals"], (prev = []) => [
        {
          ...created,
          expiresInHours: created.expiresInHours,
          maxUses: created.maxUses,
          useCount: created.useCount ?? 0,
          adminNote: created.adminNote ?? null,
        },
        ...prev,
      ]);
      const kind =
        created.maxUses === -1 ? "многоразовый" : created.maxUses && created.maxUses > 1 ? `${created.maxUses} регистраций` : "одноразовый";
      toast({ title: "Код создан", description: `${created.code} · ${kind}` });
      setCodeNote("");
      navigator.clipboard
        .writeText(created.code)
        .then(() => toast({ title: "Код скопирован в буфер" }))
        .catch(() => {});
    },
    onError: (e) => {
      toast({ title: e instanceof Error ? e.message : "Ошибка создания кода", variant: "destructive" });
    },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(
      () => toast({ title: "Код скопирован" }),
      () => toast({ title: "Не удалось скопировать", variant: "destructive" })
    );
  };

  const labelUser = (r: AdminInviteMoreRequestRow) =>
    [r.displayName, r.surname].filter(Boolean).join(" ").trim() || `ID ${r.publicId}`;

  const settingsChanged =
    !!referralSettings &&
    (settingsDraft.defaultInvites !== referralSettings.defaultInvites ||
      settingsDraft.repeatEnabled !== referralSettings.repeatEnabled ||
      settingsDraft.repeatInvites !== referralSettings.repeatInvites ||
      settingsDraft.repeatAfterHours !== referralSettings.repeatAfterHours ||
      settingsDraft.multiUseDefaultExpiresHours !== referralSettings.multiUseDefaultExpiresHours);

  const parsePositiveInt = (raw: string, fallback: number, min: number, max: number) => {
    const n = Number.parseInt(raw.trim(), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };

  return (
    <div className={cn(adminPageStackClass(), "space-y-6")}>
      <AdminPageHeader
        title="Пригласительные коды"
        description="Программа приглашений, заявки на доп. слоты, создание кодов и список активных."
      />

      <AdminPanelCard className="space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Настройки программы приглашений</h2>
          <p className="mt-1 text-sm admin-text-muted">
            Глобальные параметры для всех пользователей: стартовый лимит, повторная выдача, окно ожидания и срок многоразовых системных кодов.
          </p>
        </div>
        <div className="space-y-4">
          {settingsLoading ? (
            <div className="space-y-2 py-1">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : settingsError ? (
            <ErrorWithRetry
              title="Не удалось загрузить настройки приглашений"
              description={settingsError instanceof Error ? settingsError.message : "Не удалось загрузить данные"}
              onRetry={() => void refetchSettings()}
              className="min-h-[180px]"
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="ref-default-invites">Приглашений по умолчанию</Label>
                  <Input
                    id="ref-default-invites"
                    type="number"
                    min={1}
                    max={200}
                    value={settingsDraft.defaultInvites}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        defaultInvites: parsePositiveInt(e.target.value, prev.defaultInvites, 1, 200),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ref-repeat-invites">Повторно выдавать (шт.)</Label>
                  <Input
                    id="ref-repeat-invites"
                    type="number"
                    min={1}
                    max={500}
                    value={settingsDraft.repeatInvites}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        repeatInvites: parsePositiveInt(e.target.value, prev.repeatInvites, 1, 500),
                      }))
                    }
                    disabled={!settingsDraft.repeatEnabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ref-repeat-after-hours">Через сколько повторно (часы)</Label>
                  <Input
                    id="ref-repeat-after-hours"
                    type="number"
                    min={1}
                    max={24 * 90}
                    value={settingsDraft.repeatAfterHours}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        repeatAfterHours: parsePositiveInt(e.target.value, prev.repeatAfterHours, 1, 24 * 90),
                      }))
                    }
                    disabled={!settingsDraft.repeatEnabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ref-multi-use-ttl">TTL многоразовых по умолчанию (часы)</Label>
                  <Input
                    id="ref-multi-use-ttl"
                    type="number"
                    min={1}
                    max={24 * 90}
                    value={settingsDraft.multiUseDefaultExpiresHours}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        multiUseDefaultExpiresHours: parsePositiveInt(
                          e.target.value,
                          prev.multiUseDefaultExpiresHours,
                          1,
                          24 * 90,
                        ),
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 min-h-[var(--uix-touch-min)] rounded-lg border border-border bg-muted/20 px-3 py-2">
                <Switch
                  id="ref-repeat-enabled"
                  checked={settingsDraft.repeatEnabled}
                  onCheckedChange={(v) => setSettingsDraft((prev) => ({ ...prev, repeatEnabled: v }))}
                  aria-label="Включить повторную выдачу приглашений"
                />
                <Label htmlFor="ref-repeat-enabled" className="cursor-pointer">
                  Повторная выдача включена
                </Label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => settingsMut.mutate()}
                  disabled={settingsMut.isPending || !settingsChanged}
                >
                  {settingsMut.isPending ? "Сохранение…" : "Сохранить настройки"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Текущий сценарий: {settingsDraft.defaultInvites} стартовых, затем{" "}
                  {settingsDraft.repeatEnabled
                    ? `+${settingsDraft.repeatInvites} через ${settingsDraft.repeatAfterHours} ч`
                    : "авто-довыдача выключена"}
                  .
                </p>
              </div>
            </>
          )}
        </div>
      </AdminPanelCard>

      <AdminPanelCard className="space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-[hsl(210_20%_98%)]">
            <Inbox className="h-4 w-4" />
            Заявки на доп. приглашения
          </h2>
          <p className="mt-1 text-sm admin-text-muted">
            Пользователи подают запрос со страницы «Как пригласить друзей». Одобрение увеличивает лимит
            приглашений (по умолчанию +3 слота).
          </p>
        </div>
        <div>
          {inviteMoreLoading ? (
            <div className="space-y-2 py-1">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : inviteMoreError ? (
            <ErrorWithRetry
              title="Не удалось загрузить заявки"
              description={inviteMoreError instanceof Error ? inviteMoreError.message : "Не удалось загрузить данные"}
              onRetry={() => void refetchInviteMore()}
              className="min-h-[180px]"
            />
          ) : inviteMoreList.length === 0 ? (
            <ListEmptyState
              icon={Inbox}
              title="Нет ожидающих заявок"
              description="Когда пользователи запросят дополнительные приглашения, они появятся здесь."
              actionLabel="Обновить"
              onAction={() => void refetchInviteMore()}
              className="min-h-[180px]"
            />
          ) : (
            <ul className="space-y-3">
              {inviteMoreList.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-border bg-muted/30 p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{labelUser(r)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateWithYearLocal(new Date(r.createdAt))} · userId:{" "}
                        <code className="text-[11px]">{r.userId.slice(0, 8)}…</code>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        disabled={inviteMoreMut.isPending}
                        onClick={() => inviteMoreMut.mutate({ id: r.id, action: "approve", bonusInvites: 3 })}
                      >
                        +3 слота
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={inviteMoreMut.isPending}
                        onClick={() => inviteMoreMut.mutate({ id: r.id, action: "approve", bonusInvites: 5 })}
                      >
                        +5
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={inviteMoreMut.isPending}
                        onClick={() => inviteMoreMut.mutate({ id: r.id, action: "reject" })}
                      >
                        Отклонить
                      </Button>
                    </div>
                  </div>
                  {r.message?.trim() ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap border-t border-border/60 pt-2">
                      {r.message.trim()}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </AdminPanelCard>

      <AdminPanelCard className="space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-[hsl(210_20%_98%)]">
            <Ticket className="h-4 w-4" />
            Создать код
          </h2>
          <p className="mt-1 text-sm admin-text-muted">
            Админ может создавать неограниченное количество кодов. Регистрация только по приглашению. Обычный пользователь — до 3 приглашений.
            Многоразовый код можно вставить в рассылку: регистрируются многие, пока не истечёт срок.
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-2 min-h-[var(--uix-touch-min)]">
              <Switch
                id="referral-multi-use"
                checked={multiUseUnlimited}
                onCheckedChange={(v) => {
                  setMultiUseUnlimited(v);
                  if (v) setCappedUses("");
                }}
                aria-label="Многоразовый код без лимита"
              />
              <Label htmlFor="referral-multi-use" className="text-sm font-normal cursor-pointer">
                Многоразовый до истечения срока
              </Label>
            </div>
            {!multiUseUnlimited ? (
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <Label htmlFor="referral-capped" className="text-xs text-muted-foreground">
                  Или лимит регистраций (необязательно, 2–10000)
                </Label>
                <Input
                  id="referral-capped"
                  type="number"
                  min={2}
                  max={10_000}
                  placeholder="Пусто = один раз"
                  value={cappedUses}
                  onChange={(e) => setCappedUses(e.target.value)}
                  className="max-w-xs"
                />
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="referral-admin-note" className="text-xs text-muted-foreground">
              Подпись (необязательно)
            </Label>
            <Textarea
              id="referral-admin-note"
              placeholder="Например: выдал Егор · для ресторанов на Невском"
              value={codeNote}
              onChange={(e) => setCodeNote(e.target.value.slice(0, ADMIN_NOTE_MAX))}
              rows={2}
              className="max-w-xl resize-y min-h-[52px]"
            />
            <p className="text-[11px] text-muted-foreground">
              Видна только в админке, до {ADMIN_NOTE_MAX} символов.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Создание…" : "Создать код"}
            </Button>
          </div>
        </div>
      </AdminPanelCard>

      <AdminPanelCard className="space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Активные коды</h2>
          <p className="mt-1 text-sm admin-text-muted">
            Срок действия {DEFAULT_EXPIRES_HOURS / 24} дней. Одноразовый код сгорает после первой регистрации; многоразовый — действует до даты или до лимита.
          </p>
        </div>
        <div>
          {isLoading ? (
            <div className="space-y-2 py-1">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <ErrorWithRetry
              title="Не удалось загрузить коды"
              description={error instanceof Error ? error.message : "Не удалось загрузить данные"}
              onRetry={() => void refetch()}
              className="min-h-[180px]"
            />
          ) : codes.length === 0 ? (
            <ListEmptyState
              icon={Ticket}
              title="Нет активных кодов"
              description="Создайте первый код для приглашения пользователей."
              actionLabel="Создать код"
              onAction={() => createMutation.mutate()}
              className="min-h-[180px]"
            />
          ) : (
            <ul className="space-y-2">
              {codes.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-muted/50 border border-border"
                >
                  <div className="min-w-0">
                    <code className="text-sm font-mono break-all">{c.code}</code>
                    <p className="text-xs text-muted-foreground mt-0.5">{usesLabel(c.maxUses, c.useCount)}</p>
                    {c.adminNote?.trim() ? (
                      <p className="text-xs text-foreground/80 mt-1 whitespace-pre-wrap border-l-2 border-primary/30 pl-2">
                        {c.adminNote.trim()}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      до {formatDateWithYearLocal(new Date(c.expiresAt))}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => copyCode(c.code)}
                      aria-label="Скопировать код"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </AdminPanelCard>
    </div>
  );
}
