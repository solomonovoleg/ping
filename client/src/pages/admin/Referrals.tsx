import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  createAdminReferralCode,
  fetchAdminReferralCodes,
  type AdminReferralCode,
} from "@/lib/admin";
import { useToast } from "@/hooks/use-toast";
import { formatDateWithYearLocal } from "@/lib/timezone";
import { Copy, Ticket } from "lucide-react";

const DEFAULT_EXPIRES_HOURS = 7 * 24; // 7 дней

export default function AdminReferrals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteFormat, setInviteFormat] = useState<"phrase" | "digits">("phrase");

  const { data: codes = [], isLoading, error } = useQuery({
    queryKey: ["admin", "referrals"],
    queryFn: fetchAdminReferralCodes,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createAdminReferralCode({ format: inviteFormat, expiresInHours: DEFAULT_EXPIRES_HOURS }),
    onSuccess: (created) => {
      queryClient.setQueryData<AdminReferralCode[]>(["admin", "referrals"], (prev = []) => [
        { ...created, expiresInHours: created.expiresInHours },
        ...prev,
      ]);
      toast({ title: "Код создан", description: created.code });
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
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
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
            Срок действия {DEFAULT_EXPIRES_HOURS / 24} дней. После использования код становится недействителен.
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
                  <code className="text-sm font-mono break-all">{c.code}</code>
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
