import { useState, useEffect } from "react";
import {
  Bell,
  Lock,
  Database,
  HelpCircle,
  LogOut,
  ChevronRight,
  Camera,
  Sun,
  Moon,
  Sparkles,
  Shield,
  UserPlus,
  Copy,
  Check,
  MessageCircle,
  Bookmark,
  Volume2,
  Type,
  Trash2,
  ExternalLink,
  Mail,
  Users,
  Mic,
  Video,
  Loader2,
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { logout, updateProfile, deleteAccount, patchVibeSettings } from "@/lib/auth";
import { getPrivacyPolicyUrl, getSupportEmail } from "@/lib/legal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { getSavedTheme, setTheme, type ThemeId } from "@/lib/theme";
import { getMicroSoundsEnabled, setMicroSoundsEnabled } from "@/lib/micro-feedback";
import { getSpellCheckEnabled, setSpellCheckEnabled } from "@/lib/spellcheck-prefs";
import { getStoryBeautyEnabled, setStoryBeautyEnabled } from "@/lib/story-prefs";
import { getMyReferralCodes, createReferralCode, getInvitedUsers, type InvitedUser } from "@/lib/referrals";
import { formatDateWithYearLocal } from "@/lib/timezone";
import { startDm } from "@/lib/search";
import {
  primeMicrophoneCapture,
  primeCameraAndMicrophoneCapture,
} from "@/lib/media-capture-prime";
import { usePrefersReducedMotion } from "@/lib/motion";
import { SettingsDataMemoryCard } from "@/features/settings/components/SettingsDataMemoryCard";

import { PageTitle } from "@/components/PageTitle";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/UserAvatar";
import { useToast } from "@/hooks/use-toast";

const ADMIN_ROLES = ["moderator", "admin", "super_admin"];

/** Вторая витрина «создатель» внизу настроек (как у Олега). Поменяй путь/текст под свой публичный id. */
const CREATOR_SECOND_CARD = {
  profilePath: "/profile/5",
  title: "Создатель Александр",
  subtitle: "Профиль участника id5",
  /** Пока нет отдельного PNG — логотип приложения; можно положить `creator-aleks.png` в `client/public/` и сменить src */
  avatarSrc: "/F-PING.png",
  avatarAlt: "Создатель Александр",
} as const;

type MediaPermissionState = PermissionState | "unknown";

export default function Settings() {
  const { user, refetch } = useAuth();
  const reducedMotion = usePrefersReducedMotion();
  const [theme, setThemeState] = useState<ThemeId>("light");
  const [referralData, setReferralData] = useState<{
    codes: { id: string; code: string; expiresAt: string }[];
    usedCount: number;
    limit: number;
    remaining: number;
  } | null>(null);
  const [creatingCode, setCreatingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [inviteFormat, setInviteFormat] = useState<"phrase" | "digits">("phrase");
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [openingChatUserId, setOpeningChatUserId] = useState<string | null>(null);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);
  const [microSounds, setMicroSoundsState] = useState(getMicroSoundsEnabled);
  const [spellCheck, setSpellCheckState] = useState(getSpellCheckEnabled);
  const [storyBeauty, setStoryBeautyState] = useState(getStoryBeautyEnabled);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [mediaPrimeBusy, setMediaPrimeBusy] = useState<null | "mic" | "cam">(null);
  const [microphonePermission, setMicrophonePermission] = useState<MediaPermissionState>("unknown");
  const [cameraPermission, setCameraPermission] = useState<MediaPermissionState>("unknown");
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const scrollToSettingsSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  };

  useEffect(() => {
    const handler = () => setMicroSoundsState(getMicroSoundsEnabled());
    window.addEventListener("ping:micro-sounds-change", handler);
    return () => window.removeEventListener("ping:micro-sounds-change", handler);
  }, []);

  const handleHideFromSearchChange = async (checked: boolean) => {
    setPrivacySaving(true);
    try {
      await updateProfile({ hideFromSearch: checked });
      await refetch();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Не сохранено", variant: "destructive" });
      await refetch();
    } finally {
      setPrivacySaving(false);
    }
  };

  const handleDmPolicyChange = async (value: "all" | "followers" | "mutual") => {
    setPrivacySaving(true);
    try {
      await updateProfile({ dmPolicy: value });
      await refetch();
      toast({ title: "Сохранено", duration: 1800 });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Не сохранено", variant: "destructive" });
      await refetch();
    } finally {
      setPrivacySaving(false);
    }
  };

  const handleGroupAddMePolicyChange = async (value: "all" | "followers" | "mutual") => {
    setPrivacySaving(true);
    try {
      await updateProfile({ groupAddMePolicy: value });
      await refetch();
      toast({ title: "Сохранено", duration: 1800 });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Не сохранено", variant: "destructive" });
      await refetch();
    } finally {
      setPrivacySaving(false);
    }
  };

  const handlePushEnabledChange = async (checked: boolean) => {
    setPushSaving(true);
    try {
      await updateProfile({ pushEnabled: checked });
      await refetch();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Не сохранено", variant: "destructive" });
      await refetch();
    } finally {
      setPushSaving(false);
    }
  };

  const loadReferrals = async () => {
    try {
      const data = await getMyReferralCodes();
      setReferralData(data);
    } catch {
      setReferralData(null);
      toast({ title: "Не удалось загрузить приглашения", variant: "destructive" });
    }
  };

  useEffect(() => {
    loadReferrals();
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
      setLocation(`/chat/${encodeURIComponent(chat.id)}`);
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
      await createReferralCode(inviteFormat);
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

  const handleLogout = async () => {
    try {
      await logout();
      await refetch();
    } catch (e) {
      toast({ title: "Ошибка выхода. Попробуйте снова.", variant: "destructive" });
    }
  };

  const handleDeleteAccountConfirm = async () => {
    setDeleteAccountLoading(true);
    try {
      await deleteAccount();
      await logout();
      setDeleteDialogOpen(false);
      setLocation("/login");
      toast({ title: "Аккаунт удалён" });
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Не удалось удалить аккаунт",
        variant: "destructive",
      });
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  // Синхронизировать state с сохранённой темой при монтировании
  useEffect(() => {
    setThemeState(getSavedTheme());
  }, []);

  const changeTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme);
    setTheme(newTheme);
  };

  const readPermissionState = async (name: "microphone" | "camera"): Promise<MediaPermissionState> => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unknown";
    try {
      const status = await navigator.permissions.query({ name: name as PermissionName });
      return status.state;
    } catch {
      return "unknown";
    }
  };

  const refreshMediaPermissionStates = async () => {
    const [micState, camState] = await Promise.all([
      readPermissionState("microphone"),
      readPermissionState("camera"),
    ]);
    setMicrophonePermission(micState);
    setCameraPermission(camState);
  };

  useEffect(() => {
    void refreshMediaPermissionStates();
  }, []);

  const getPermissionLabel = (state: MediaPermissionState) => (state === "granted" ? "Активно" : "Не активно");
  const isMicrophoneActive = microphonePermission === "granted";
  const isCameraAndMicActive = microphonePermission === "granted" && cameraPermission === "granted";

  const runPrimeMicrophone = async () => {
    setMediaPrimeBusy("mic");
    try {
      const r = await primeMicrophoneCapture();
      if (r === "granted") {
        toast({
          title: "Микрофон разрешён",
          description: "Тот же доступ будет использоваться для звонков, голосовых и распознавания речи.",
        });
      } else if (r === "denied") {
        toast({
          title: "Доступ к микрофону не дан",
          description: "Разрешите в настройках браузера или системы для этого сайта / приложения.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Микрофон недоступен",
          description: "Проверьте HTTPS и поддержку браузера.",
          variant: "destructive",
        });
      }
    } finally {
      await refreshMediaPermissionStates();
      setMediaPrimeBusy(null);
    }
  };

  const runPrimeCameraMic = async () => {
    setMediaPrimeBusy("cam");
    try {
      const r = await primeCameraAndMicrophoneCapture();
      if (r === "granted") {
        toast({
          title: "Камера и микрофон разрешены",
          description: "Подходит для видеозвонков и съёмки в веб-версии.",
        });
      } else if (r === "denied") {
        toast({
          title: "Доступ не дан",
          description: "Разрешите камеру и микрофон в настройках браузера или системы.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Не удалось получить доступ",
          description: "Проверьте устройство и ограничения браузера.",
          variant: "destructive",
        });
      }
    } finally {
      await refreshMediaPermissionStates();
      setMediaPrimeBusy(null);
    }
  };

  return (
    <div className="flex h-full w-full max-w-full min-w-0 overflow-x-hidden justify-center bg-secondary/30">
      <PageTitle title="Настройки" />
      <div className="w-full max-w-full min-w-0 h-full flex flex-col bg-background overflow-y-auto overflow-x-hidden pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))]">
        
        {/* Header */}
        <div className="uix-content-x py-4 glass z-10 sticky top-0 flex justify-between items-center">
          <span className="uix-text-title font-semibold">Настройки</span>
          <button
            type="button"
            onClick={() => setLocation("/profile/edit")}
            className="text-primary font-medium text-[15px] min-h-[var(--uix-touch-min)] px-2 -mr-2 rounded-lg hover:bg-secondary/50 transition-colors"
            aria-label="Редактировать профиль"
          >
            Изм.
          </button>
        </div>

        {/* Profile Section — переход на свою страницу профиля */}
        <div
          onClick={() => setLocation("/profile/me")}
          className="p-6 flex flex-col items-center justify-center border-b border-border/30 bg-card cursor-pointer hover:bg-secondary/20 transition-colors duration-75 active:scale-[0.98]"
        >
          <div className="relative mb-4 group cursor-pointer">
            <UserAvatar
              avatarUrl={user?.avatarUrl}
              displayName={user?.displayName ? [user.displayName, user.surname].filter(Boolean).join(" ") : undefined}
              seed={user?.id}
              size={96}
              className="w-24 h-24 border-2 border-background shadow-md group-hover:opacity-80 transition-opacity"
            />
            <div className="absolute bottom-0 right-0 p-1.5 bg-primary rounded-full text-white shadow-sm border-2 border-background">
              <Camera className="w-4 h-4" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-1">
            {user?.displayName || user?.surname ? [user.displayName, user.surname].filter(Boolean).join(" ") : "Мой профиль"}
          </h2>
          <p className="text-muted-foreground text-[15px] mb-3 text-center max-w-sm">
            Номер телефона не показывается в приложении и не передаётся в запросах — только для входа.
          </p>
          <p className="text-[15px] text-center max-w-sm text-foreground/80 leading-snug">
            {(user as { bio?: string } | undefined)?.bio?.trim() || "Расскажите о себе в профиле."}
          </p>
        </div>

        <div className="p-4 flex flex-col gap-6 bg-secondary/20 flex-1">
          
          {/* Theme Selector */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-4">
              Оформление
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => changeTheme('light')}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300",
                  theme === 'light' ? "border-primary bg-primary/5" : "border-transparent bg-card shadow-sm hover:scale-95"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 mb-1">
                  <Sun className="w-5 h-5" />
                </div>
                <span className={cn("text-[13px] font-medium", theme === "light" ? "text-primary" : "text-foreground")}>Светлая</span>
              </button>
              
              <button 
                onClick={() => changeTheme('dark')}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300",
                  theme === 'dark' ? "border-primary bg-primary/5" : "border-transparent bg-card shadow-sm hover:scale-95"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 mb-1">
                  <Moon className="w-5 h-5" />
                </div>
                <span className={cn("text-[13px] font-medium", theme === "dark" ? "text-primary" : "text-foreground")}>Тёмная</span>
              </button>

              <button 
                onClick={() => changeTheme('fitfin')}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden",
                  theme === 'fitfin' ? "border-[#FF6B35] bg-[#FF6B35]/5" : "border-transparent bg-card shadow-sm hover:scale-95"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FF6B35] to-[#FF9F1C] flex items-center justify-center text-white mb-1 shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className={cn("text-[13px] font-medium", theme === "fitfin" ? "text-[#FF6B35]" : "text-foreground")}>Фитфин</span>
              </button>
            </div>
          </div>

          {/* Уведомления */}
          <div id="settings-notifications" className="flex flex-col gap-2 scroll-mt-24">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-4">
              Уведомления
            </h3>
            <button
              type="button"
              onClick={() => setLocation("/notifications")}
              className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border/50 bg-card shadow-sm hover:bg-secondary/30 transition-colors text-left min-h-[var(--uix-touch-min)]"
              aria-label="Открыть ленту уведомлений"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Лента уведомлений</p>
                  <p className="text-xs text-muted-foreground">Лайки, комментарии, подписки</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </button>
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border/50 bg-card shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Пуш о новых сообщениях</p>
                  <p className="text-xs text-muted-foreground">Уведомления в чатах</p>
                </div>
              </div>
              <Switch
                checked={user?.pushEnabled !== false}
                onCheckedChange={handlePushEnabledChange}
                disabled={pushSaving}
              />
            </div>
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border/50 bg-card shadow-sm mt-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Микро-звуки</p>
                  <p className="text-xs text-muted-foreground">Тап, отправка, лайк</p>
                </div>
              </div>
              <Switch
                checked={microSounds}
                onCheckedChange={(checked) => {
                  setMicroSoundsEnabled(checked);
                  setMicroSoundsState(checked);
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border/50 bg-card shadow-sm mt-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Type className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Автоисправление орфографии</p>
                  <p className="text-xs text-muted-foreground">В чатах при наборе сообщения</p>
                </div>
              </div>
              <Switch
                checked={spellCheck}
                onCheckedChange={(checked) => {
                  setSpellCheckEnabled(checked);
                  setSpellCheckState(checked);
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border/50 bg-card shadow-sm mt-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Beauty для кружков</p>
                  <p className="text-xs text-muted-foreground">Лёгкая маска только для кружков, не для просмотра сториз</p>
                </div>
              </div>
              <Switch
                checked={storyBeauty}
                onCheckedChange={(checked) => {
                  setStoryBeautyEnabled(checked);
                  setStoryBeautyState(checked);
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-4">
              Камера и микрофон
            </h3>
            <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-[var(--uix-touch-min)] justify-between gap-2 sm:flex-1"
                  disabled={mediaPrimeBusy !== null}
                  onClick={() => void runPrimeMicrophone()}
                >
                  <span className="flex items-center gap-2">
                    {mediaPrimeBusy === "mic" ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : (
                      <Mic className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    Микрофон
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium rounded-full px-2 py-0.5",
                      isMicrophoneActive ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {getPermissionLabel(microphonePermission)}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-[var(--uix-touch-min)] justify-between gap-2 sm:flex-1"
                  disabled={mediaPrimeBusy !== null}
                  onClick={() => void runPrimeCameraMic()}
                >
                  <span className="flex items-center gap-2">
                    {mediaPrimeBusy === "cam" ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : (
                      <Video className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    Камера + микрофон
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium rounded-full px-2 py-0.5",
                      isCameraAndMicActive ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isCameraAndMicActive ? "Активно" : "Не активно"}
                  </span>
                </Button>
              </div>
            </div>
          </div>

          {/* Chat Vibe / Atmosphere section */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-4">
              Атмосфера чата
            </h3>
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border/50 bg-card shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Адаптивная атмосфера</p>
                  <p className="text-xs text-muted-foreground">Фон чата подстраивается под настроение разговора</p>
                </div>
              </div>
              <Switch
                checked={user?.vibeEnabled ?? false}
                onCheckedChange={async (checked) => {
                  try {
                    await patchVibeSettings({ vibeEnabled: checked });
                    await refetch();
                  } catch (e) {
                    toast({ title: e instanceof Error ? e.message : "Не сохранено", variant: "destructive" });
                  }
                }}
              />
            </div>
            {user?.vibeEnabled && (
              <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border/50 bg-card shadow-sm mt-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Делиться с собеседником</p>
                    <p className="text-xs text-muted-foreground">Собеседник тоже увидит атмосферу</p>
                  </div>
                </div>
                <Switch
                  checked={user?.vibeShareWithPartner ?? false}
                  onCheckedChange={async (checked) => {
                    try {
                      await patchVibeSettings({ vibeShareWithPartner: checked });
                      await refetch();
                    } catch (e) {
                      toast({ title: e instanceof Error ? e.message : "Не сохранено", variant: "destructive" });
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Invite section */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-4">
              Приглашения
            </h3>
            <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm p-4 space-y-3">
              {referralData && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Приглашено: {referralData.usedCount} из {referralData.limit}. Осталось: {referralData.remaining}.
                  </p>
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
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setInviteFormat("phrase")}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                        inviteFormat === "phrase"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Словосочетание
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteFormat("digits")}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                        inviteFormat === "digits"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      4 цифры
                    </button>
                  </div>
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
              )}
              {!referralData && (
                <p className="text-sm text-muted-foreground">Загрузка…</p>
              )}
            </div>
          </div>

          {/* Invited users — те, кого я пригласил */}
          {invitedUsers.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-4">
                Приглашённые вами
              </h3>
              <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm">
                {invitedUsers.map((invited) => {
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
              </div>
            </div>
          )}

          {/* Приватность */}
          <div id="settings-privacy" className="scroll-mt-24">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-4">
              Приватность
            </h3>
            <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm p-4 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white bg-blue-500 shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[16px] font-medium">Скрыть профиль из поиска</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Вас не найдут в глобальном поиске. Написать и создать чат можно только по прямой ссылке и только если вы в контактах у человека.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={user?.hideFromSearch ?? false}
                  onCheckedChange={handleHideFromSearchChange}
                  disabled={privacySaving}
                  className="shrink-0"
                />
              </div>
              <div className="mt-4 space-y-4 border-t border-border/40 pt-4">
                <div>
                  <p className="text-[15px] font-medium">Личные сообщения</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Кто может начать с вами новый диалог. «Подписчики» — пользователи, которые подписаны на вас.
                    «Взаимно» — только если вы и собеседник подписаны друг на друга.
                  </p>
                  <label className="sr-only" htmlFor="settings-dm-policy">
                    Политика личных сообщений
                  </label>
                  <select
                    id="settings-dm-policy"
                    className="mt-2 w-full min-h-[var(--uix-touch-min)] rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm"
                    value={user?.dmPolicy ?? "all"}
                    onChange={(e) =>
                      void handleDmPolicyChange(e.target.value as "all" | "followers" | "mutual")
                    }
                    disabled={privacySaving}
                  >
                    <option value="all">Все пользователи</option>
                    <option value="followers">Только подписчики (на меня подписаны)</option>
                    <option value="mutual">Только взаимная подписка</option>
                  </select>
                </div>
                <div>
                  <p className="text-[15px] font-medium">Групповые чаты</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Кто может добавлять вас в группу. «Подписчики» — вы должны быть подписаны на того, кто
                    добавляет. «Взаимно» — взаимная подписка с тем, кто добавляет.
                  </p>
                  <label className="sr-only" htmlFor="settings-group-add-policy">
                    Политика добавления в группы
                  </label>
                  <select
                    id="settings-group-add-policy"
                    className="mt-2 w-full min-h-[var(--uix-touch-min)] rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm"
                    value={user?.groupAddMePolicy ?? "all"}
                    onChange={(e) =>
                      void handleGroupAddMePolicyChange(e.target.value as "all" | "followers" | "mutual")
                    }
                    disabled={privacySaving}
                  >
                    <option value="all">Любой админ группы</option>
                    <option value="followers">Только если я подписан на добавляющего</option>
                    <option value="mutual">Только взаимная подписка с добавляющим</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Данные на устройстве */}
          <div id="settings-storage" className="scroll-mt-24">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-4">
              Данные и память
            </h3>
            <SettingsDataMemoryCard
              onNavigateSaved={() => setLocation("/saved")}
              onOpenDataPage={() => setLocation("/settings/data")}
            />
          </div>

          {/* Быстрые переходы по разделам этой страницы */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-4">
              Основные
            </h3>
            <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm">
              {(
                [
                  {
                    icon: Bell,
                    label: "Уведомления и звуки",
                    color: "bg-orange-500",
                    targetId: "settings-notifications",
                    hint: "Пуши, лента, микро-звуки, орфография",
                  },
                  {
                    icon: Lock,
                    label: "Конфиденциальность",
                    color: "bg-blue-500",
                    targetId: "settings-privacy",
                    hint: "Поиск, личные сообщения, группы",
                  },
                  {
                    icon: Database,
                    label: "Данные и память",
                    color: "bg-green-500",
                    targetId: "settings-storage",
                    hint: "Кэш, экспорт JSON, избранное",
                    navigateTo: "/settings/data",
                  },
                ] as const
              ).map((item, j) => (
                <button
                  key={item.targetId}
                  type="button"
                  onClick={() =>
                    "navigateTo" in item ? setLocation(item.navigateTo) : scrollToSettingsSection(item.targetId)
                  }
                  className={cn(
                    "uix-list-row flex w-full items-center justify-between p-3.5 text-left hover:bg-secondary/50 cursor-pointer transition-colors duration-75 active:bg-secondary active:scale-[0.99] min-h-[var(--uix-touch-min)]",
                    j < 2 && "border-b border-border/50",
                  )}
                  aria-label={`${item.label}: перейти к разделу`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0", item.color)}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[16px] font-medium block">{item.label}</span>
                      <span className="text-xs text-muted-foreground truncate block">{item.hint}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-4">
              Прочее
            </h3>
            <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm">
              {ADMIN_ROLES.includes(user?.platformRole ?? "") && (
                <a
                  href="/admin"
                  className="uix-list-row flex items-center justify-between p-3.5 hover:bg-secondary/50 cursor-pointer transition-colors active:bg-secondary border-b border-border/50"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white bg-violet-500">
                      <Shield className="w-4 h-4" />
                    </div>
                    <span className="text-[16px] font-medium">Админ-панель</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
                </a>
              )}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setLocation("/saved")}
                onKeyDown={(e) => e.key === "Enter" && setLocation("/saved")}
                className="uix-list-row flex items-center justify-between p-3.5 hover:bg-secondary/50 cursor-pointer transition-colors duration-75 active:bg-secondary border-b border-border/50"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white bg-amber-500">
                    <Bookmark className="w-4 h-4" />
                  </div>
                  <span className="text-[16px] font-medium">Избранное</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <a
                href={getPrivacyPolicyUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="uix-list-row flex items-center justify-between p-3.5 hover:bg-secondary/50 cursor-pointer transition-colors duration-75 active:bg-secondary border-b border-border/50"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white bg-slate-500">
                    <Shield className="w-4 h-4" />
                  </div>
                  <span className="text-[16px] font-medium">Политика конфиденциальности</span>
                </div>
                <ExternalLink className="w-5 h-5 text-muted-foreground/50" />
              </a>
              <a
                href={`mailto:${getSupportEmail()}`}
                className="uix-list-row flex items-center justify-between p-3.5 hover:bg-secondary/50 cursor-pointer transition-colors duration-75 active:bg-secondary border-b border-border/50"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white bg-teal-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <span className="text-[16px] font-medium">Поддержка</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
              </a>
              <button
                type="button"
                onClick={() => setHelpDialogOpen(true)}
                className="uix-list-row flex w-full items-center justify-between p-3.5 hover:bg-secondary/50 cursor-pointer transition-colors duration-75 active:bg-secondary text-left min-h-[var(--uix-touch-min)] border-b border-border/50"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white bg-teal-500">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <span className="text-[16px] font-medium">Помощь</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => setAboutDialogOpen(true)}
                className="uix-list-row flex w-full items-center justify-between p-3.5 hover:bg-secondary/50 cursor-pointer transition-colors duration-75 active:bg-secondary text-left min-h-[var(--uix-touch-min)]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-muted">
                    <span className="text-xs font-semibold text-muted-foreground">i</span>
                  </div>
                  <span className="text-[16px] font-medium text-foreground">О приложении</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : "—"}
                </span>
              </button>
            </div>
          </div>

          {/* Creator card */}
          <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm mt-2">
            <button
              type="button"
              onClick={() => setLocation("/profile/2")}
              className="w-full flex items-center justify-between gap-3 p-3.5 hover:bg-secondary/50 transition-colors duration-75 active:scale-[0.99]"
              aria-label="Открыть профиль участника id2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src="/creator-oleg-solomonov.png"
                  alt="Создатель Олег Соломнов"
                  className="w-10 h-10 shrink-0 rounded-xl object-contain bg-transparent"
                  loading="lazy"
                />
                <div className="min-w-0 text-left">
                  <p className="text-sm font-medium text-foreground truncate">Создатель Олег Соломнов</p>
                  <p className="text-xs text-muted-foreground truncate">Профиль участника id2</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0" />
            </button>
          </div>

          {/* Второй создатель — та же витрина, что у Олега */}
          <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm mt-2">
            <button
              type="button"
              onClick={() => setLocation(CREATOR_SECOND_CARD.profilePath)}
              className="w-full flex items-center justify-between gap-3 p-3.5 hover:bg-secondary/50 transition-colors duration-75 active:scale-[0.99]"
              aria-label={`Открыть профиль: ${CREATOR_SECOND_CARD.title}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={CREATOR_SECOND_CARD.avatarSrc}
                  alt={CREATOR_SECOND_CARD.avatarAlt}
                  className="w-10 h-10 shrink-0 rounded-xl object-contain bg-transparent"
                  loading="lazy"
                />
                <div className="min-w-0 text-left">
                  <p className="text-sm font-medium text-foreground truncate">{CREATOR_SECOND_CARD.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{CREATOR_SECOND_CARD.subtitle}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0" />
            </button>
          </div>

          {/* Профиль участника id 5 (тот же паттерн, что и карточка создателя) */}
          {user?.publicId === 5 ? (
            <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm mt-2">
              <button
                type="button"
                onClick={() => setLocation("/profile/me")}
                className="w-full flex items-center justify-between gap-3 p-3.5 hover:bg-secondary/50 transition-colors duration-75 active:scale-[0.99]"
                aria-label="Открыть мой профиль, публичный id 5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    avatarUrl={user.avatarUrl ?? undefined}
                    displayName={[user.displayName, user.surname].filter(Boolean).join(" ") || "Профиль"}
                    seed={user.id}
                    size={40}
                    className="h-10 w-10 shrink-0 rounded-xl"
                  />
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-medium text-foreground truncate">
                      {[user.displayName, user.surname].filter(Boolean).join(" ") || "Профиль id 5"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      ID {user.publicId}
                      {user.city ? ` · ${user.city}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground/90 truncate mt-0.5">
                      {user.bio?.trim() || "я дамб"}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0" />
              </button>
            </div>
          ) : null}

          {/* Logout Button */}
          <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm mt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 min-h-[var(--uix-touch-min)] p-4 text-red-500 hover:bg-red-500/10 transition-colors duration-75 font-medium active:scale-[0.98]"
            >
              <LogOut className="w-5 h-5" />
              Выйти из аккаунта
            </button>
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              className="w-full flex items-center justify-center gap-2 min-h-[var(--uix-touch-min)] p-4 text-muted-foreground hover:bg-secondary/50 transition-colors duration-75 text-sm border-t border-border/50"
            >
              <Trash2 className="w-4 h-4" />
              Удалить аккаунт
            </button>
          </div>

          <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Помощь</DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-3 text-sm text-muted-foreground pt-1">
                    <p>
                      <span className="font-medium text-foreground">Уведомления не приходят</span> — проверьте системные
                      разрешения для браузера или приложения и переключатель «Пуш о новых сообщениях» выше.
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Нет звука в звонках</span> — в блоке «Камера и микрофон»
                      запросите доступ к микрофону; на телефоне проверьте настройки ОС для приложения.
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Личные сообщения</span> — кто может написать первым,
                      задаётся в разделе «Приватность» (политика ЛС и групп).
                    </p>
                    <p>
                      Если проблема не решается, напишите в поддержку — приложите скрин и время события.
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button type="button" className="w-full" asChild>
                  <a href={`mailto:${getSupportEmail()}`}>Написать в поддержку</a>
                </Button>
                <Button type="button" variant="secondary" className="w-full" onClick={() => setHelpDialogOpen(false)}>
                  Закрыть
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={aboutDialogOpen} onOpenChange={setAboutDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>PING</DialogTitle>
                <DialogDescription className="text-left space-y-2">
                  <span className="block text-sm text-muted-foreground">
                    Мессенджер и лента: чаты, звонки, посты, сториз и профили. Веб и мобильные приложения.
                  </span>
                  <span className="block text-sm">
                    <span className="text-muted-foreground">Сборка:</span>{" "}
                    <span className="font-mono tabular-nums">
                      {typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : "—"}
                    </span>
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground/80">Часовой пояс (диагностика)</p>
                <p>Зона: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
                <p>
                  Смещение: UTC{new Date().getTimezoneOffset() <= 0 ? "+" : ""}
                  {-new Date().getTimezoneOffset() / 60}
                </p>
                <p>
                  Локальное время: {new Date().getHours().toString().padStart(2, "0")}:
                  {new Date().getMinutes().toString().padStart(2, "0")}
                </p>
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" className="w-full sm:w-auto" asChild>
                  <a href={getPrivacyPolicyUrl()} target="_blank" rel="noopener noreferrer">
                    Политика конфиденциальности
                  </a>
                </Button>
                <Button type="button" onClick={() => setAboutDialogOpen(false)}>
                  Закрыть
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить аккаунт?</AlertDialogTitle>
                <AlertDialogDescription>
                  Все ваши данные (профиль, чаты, посты) будут удалены. Это действие нельзя отменить.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteAccountLoading}>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleDeleteAccountConfirm();
                  }}
                  disabled={deleteAccountLoading}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteAccountLoading ? "..." : "Удалить аккаунт"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
        </div>
      </div>
    </div>
  );
}