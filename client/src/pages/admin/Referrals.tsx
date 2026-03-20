import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createAdminReferralCode,
  fetchAdminReferralCodes,
  type AdminReferralCode,
} from "@/lib/admin";
import { useToast } from "@/hooks/use-toast";
import { formatDateWithYearLocal } from "@/lib/timezone";
import { Copy, Ticket } from "lucide-react";

const DEFAULT_EXPIRES_HOURS = 7 * 24; // 7 дней

function usesLabel(maxUses?: number, useCount?: number): string {
  if (maxUses === -1) return `многоразовый · уже ${useCount ?? 0}`;
  if (maxUses != null && maxUses > 1) return `${useCount ?? 0} / ${maxUses} регистраций`;
  return "одноразовый";
}

export default function AdminReferrals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteFormat, setInviteFormat] = useState<"phrase" | "digits">("phrase");
  const [multiUseUnlimited, setMultiUseUnlimited] = useState(false);
  const [cappedUses, setCappedUses] = useState("");

  const { data: codes = [], isLoading, error } = useQuery({
    queryKey: ["admin", "referrals"],
    queryFn: fetchAdminReferralCodes,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const parsed = parseInt(cappedUses.trim(), 10);
      const maxUses =
        !multiUseUnlimited && Number.isFinite(parsed) && parsed > 1
          ? Math.min(parsed, 10_000)
          : undefined;
      return createAdminReferralCode({
        format: inviteFormat,
        expiresInHours: DEFAULT_EXPIRES_HOURS,
        multiUse: multiUseUnlimited ? true : undefined,
        maxUses,
      });
    },
    onSuccess: (created) => {
      queryClient.setQueryData<AdminReferralCode[]>(["admin", "referrals"], (prev = []) => [
        {
          ...created,
          expiresInHours: created.expiresInHours,
          maxUses: created.maxUses,
          useCount: created.useCount ?? 0,
        },
        ...prev,
      ]);
      const kind =
        created.maxUses === -1 ? "многоразовый" : created.maxUses && created.maxUses > 1 ? `${created.maxUses} регистраций` : "одноразовый";
      toast({ title: "Код создан", description: `${created.code} · ${kind}` });
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Пригласительные коды</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Ticket className="w-4 h-4" />
            Создать код
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Админ может создавать неограниченное количество кодов. Регистрация только по приглашению. Обычный пользователь — до 3 приглашений.
            Многоразовый код можно вставить в рассылку: регистрируются многие, пока не истечёт срок.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-input overflow-hidden">
              <button
                type="button"
                className={`px-3 py-2 text-sm transition-colors ${
                  inviteFormat === "phrase"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setInviteFormat("phrase")}
              >
                Фраза
              </button>
              <button
                type="button"
                className={`px-3 py-2 text-sm transition-colors ${
                  inviteFormat === "digits"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setInviteFormat("digits")}
              >
                4 цифры
              </button>
            </div>
            <Button
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Создание…" : "Создать код"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Активные коды</CardTitle>
          <p className="text-sm text-muted-foreground">
            Срок действия {DEFAULT_EXPIRES_HOURS / 24} дней. Одноразовый код сгорает после первой регистрации; многоразовый — действует до даты или до лимита.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Загрузка…</p>
          ) : error ? (
            <p className="text-destructive text-sm">
              {error instanceof Error ? error.message : "Ошибка загрузки кодов"}
            </p>
          ) : codes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Нет активных кодов. Создайте первый.</p>
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
        </CardContent>
      </Card>
    </div>
  );
}
