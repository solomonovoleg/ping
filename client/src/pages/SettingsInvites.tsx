import { useState, useEffect } from "react";
import { UserPlus, Copy, Check, MessageCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ListEmptyState } from "@/components/ui/empty";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/UserAvatar";
import { useToast } from "@/hooks/use-toast";
import { fetchHelpPagesList } from "@/lib/help-pages";
import { getMyReferralCodes, createReferralCode, getInvitedUsers, type InvitedUser } from "@/lib/referrals";
import { startDm } from "@/lib/search";
import { buildChatPath } from "@/lib/chat-route";
import { formatDateWithYearLocal } from "@/lib/timezone";
import { SettingsScreenShell } from "@/features/settings/components/SettingsScreenShell";
import { useAuth } from "@/contexts/AuthContext";

const INVITED_USERS_PREVIEW_LIMIT = 3;

export default function SettingsInvites() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: helpPagesList = [] } = useQuery({
    queryKey: ["help-pages-list"],
    queryFn: fetchHelpPagesList,
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const [referralData, setReferralData] = useState<{
    codes: { id: string; code: string; expiresAt: string }[];
    usedCount: number;
    limit: number;
    remaining: number;
    autoGrant?: {
      repeatEnabled: boolean;
      repeatInvites: number;
      repeatAfterHours: number;
      firstLimitReachedAt: string | null;
      bonusGrantedAt: string | null;
      nextGrantAt: string | null;
    };
  } | null>(null);
  const [referralLoad, setReferralLoad] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [creatingCode, setCreatingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [allInvitedDialogOpen, setAllInvitedDialogOpen] = useState(false);
  const [openingChatUserId, setOpeningChatUserId] = useState<string | null>(null);

  const loadReferrals = async () => {
    setReferralLoad("loading");
    try {
      const data = await getMyReferralCodes();
      setReferralData(data);
      setReferralLoad("ok");
    } catch {
      setReferralData(null);
      setReferralLoad("error");
      toast({ title: "Не удалось загрузить приглашения", variant: "destructive" });
    }
  };

  useEffect(() => {
    void loadReferrals();
  }, []);

  useEffect(() => {
    getInvitedUsers()
      .then(setInvitedUsers)
      .catch(() => {
        setInvitedUsers([]);
        toast({ title: "Не удалось загрузить список приглашённых", variant: "destructive" });
      });
  }, [toast]);

  const openChatWithInvited = async (invited: InvitedUser) => {
    if (openingChatUserId) return;
    setOpeningChatUserId(invited.id);
    try {
      const chat = await startDm(invited.id);
      setLocation(buildChatPath(chat, chat.id));
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Не удалось начать диалог", variant: "destructive" });
    } finally {
      setOpeningChatUserId(null);
    }
  };

  const handleCreateInvite = async () => {
    if (!referralData || referralData.remaining <= 0) return;
    setCreatingCode(true);
    try {
      await createReferralCode();
      await loadReferrals();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Не удалось создать код", variant: "destructive" });
    } finally {
      setCreatingCode(false);
    }
  };

  const copyCode = (code: string) => {
    const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
    const link = `${base}?ref=${encodeURIComponent(code)}`;
    navigator.clipboard?.writeText(link).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }).catch(() => {
      toast({ title: "Не удалось скопировать ссылку", variant: "destructive" });
    });
  };

  const invitedUsersPreview = invitedUsers.slice(0, INVITED_USERS_PREVIEW_LIMIT);
  const hasMoreInvitedUsers = invitedUsers.length > INVITED_USERS_PREVIEW_LIMIT;

  return (
    <SettingsScreenShell title="Пригласить друзей">
      {helpPagesList.length > 0 ? (
        <div className="flex flex-col gap-1.5 -mt-1 mb-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground ml-1">Памятки</p>
          <ul className="flex flex-col gap-1">
            {helpPagesList.map((p) => (
              <li key={p.slug}>
                <button
                  type="button"
                  onClick={() => setLocation(`/help/${encodeURIComponent(p.slug)}`)}
                  className="text-left text-sm font-medium text-primary hover:underline underline-offset-2"
                >
                  {p.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm p-4 space-y-3">
        {referralLoad === "loading" || referralLoad === "idle" ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : referralLoad === "error" ? (
          <ListEmptyState
            icon={UserPlus}
            title="Не удалось загрузить приглашения"
            description="Проверьте сеть и попробуйте снова"
            actionLabel="Повторить"
            onAction={() => void loadReferrals()}
          />
        ) : referralData ? (
          <>
            <p className="text-sm text-muted-foreground">
              Приглашено: {referralData.usedCount} из {referralData.limit}. Осталось: {referralData.remaining}.
            </p>
            {referralData.autoGrant?.repeatEnabled ? (
              <p className="text-xs text-muted-foreground">
                {referralData.autoGrant.bonusGrantedAt
                  ? `Повторная выдача уже начислена (+${referralData.autoGrant.repeatInvites}).`
                  : referralData.autoGrant.nextGrantAt
                    ? `После исчерпания стартового лимита вам автоматически выдастся +${referralData.autoGrant.repeatInvites} приглашений ${formatDateWithYearLocal(
                        new Date(referralData.autoGrant.nextGrantAt),
                      )}.`
                    : `После исчерпания стартового лимита автоматически выдадим +${referralData.autoGrant.repeatInvites} приглашений через ${referralData.autoGrant.repeatAfterHours} ч.`}
              </p>
            ) : null}
            {referralData.codes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Активные коды (действуют 12 ч):</p>
                {referralData.codes.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50 font-mono text-sm"
                  >
                    <span className="truncate">{c.code}</span>
                    <button
                      type="button"
                      onClick={() => copyCode(c.code)}
                      className="shrink-0 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Копировать ссылку"
                    >
                      {copiedCode === c.code ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={creatingCode || referralData.remaining <= 0}
              onClick={handleCreateInvite}
              className="w-full"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {creatingCode ? "..." : "Создать приглашение"}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Нет данных о приглашениях.</p>
        )}
      </div>

      {invitedUsers.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Приглашённые вами</h2>
          <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm">
            {invitedUsersPreview.map((invited) => {
              const displayName = [invited.displayName, invited.surname].filter(Boolean).join(" ") || `ID ${invited.publicId}`;
              const isOpening = openingChatUserId === invited.id;
              return (
                <div
                  key={invited.id}
                  className="flex items-center justify-between gap-3 p-3.5 hover:bg-secondary/50 border-b border-border/50 last:border-b-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar
                      avatarUrl={invited.avatarUrl}
                      displayName={displayName}
                      seed={invited.id}
                      size={40}
                      className="w-10 h-10 rounded-full shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-[15px] truncate">{displayName}</p>
                      {invited.createdAt && (
                        <p className="text-xs text-muted-foreground">
                          Зарегистрирован {formatDateWithYearLocal(new Date(invited.createdAt))}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isOpening}
                    onClick={() => openChatWithInvited(invited)}
                    className="shrink-0"
                  >
                    <MessageCircle className="w-4 h-4 mr-1.5" />
                    {isOpening ? "…" : "Написать"}
                  </Button>
                </div>
              );
            })}
            {hasMoreInvitedUsers ? (
              <div className="p-3 border-t border-border/50">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setAllInvitedDialogOpen(true)}
                  className="w-full"
                >
                  Показать весь список ({invitedUsers.length})
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <Dialog open={allInvitedDialogOpen} onOpenChange={setAllInvitedDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Все приглашённые</DialogTitle>
            <DialogDescription>
              Полный список пользователей, которые зарегистрировались по вашим приглашениям.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border/50 bg-card">
            {invitedUsers.map((invited) => {
              const displayName =
                [invited.displayName, invited.surname].filter(Boolean).join(" ") || `ID ${invited.publicId}`;
              const isOpening = openingChatUserId === invited.id;
              return (
                <div
                  key={`dialog-${invited.id}`}
                  className="flex items-center justify-between gap-3 p-3.5 hover:bg-secondary/50 border-b border-border/50 last:border-b-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar
                      avatarUrl={invited.avatarUrl}
                      displayName={displayName}
                      seed={invited.id}
                      size={40}
                      className="w-10 h-10 rounded-full shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-[15px] truncate">{displayName}</p>
                      {invited.createdAt && (
                        <p className="text-xs text-muted-foreground">
                          Зарегистрирован {formatDateWithYearLocal(new Date(invited.createdAt))}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isOpening}
                    onClick={() => openChatWithInvited(invited)}
                    className="shrink-0"
                  >
                    <MessageCircle className="w-4 h-4 mr-1.5" />
                    {isOpening ? "…" : "Написать"}
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </SettingsScreenShell>
  );
}
