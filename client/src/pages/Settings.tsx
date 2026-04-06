import { useEffect, useState } from "react";
import {
  Bell,
  Camera,
  Database,
  Lock,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  Sparkles,
  Sticker,
  Trash2,
  UserPlus,
  Video,
  MoreHorizontal,
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { TapScaleButton, TapScaleDiv } from "@/components/ui/tap-scale";
import { logout, deleteAccount } from "@/lib/auth";
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
import { useAuth } from "@/contexts/AuthContext";
import { getSavedTheme, setTheme, type ThemeId } from "@/lib/theme";
import { PageTitle } from "@/components/PageTitle";
import { UserAvatar } from "@/components/UserAvatar";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { user, refetch } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [theme, setThemeState] = useState<ThemeId>(() => getSavedTheme());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);

  useEffect(() => {
    const redirectInvitesHash = () => {
      if (typeof window === "undefined") return;
      if (window.location.hash !== "#settings-invites") return;
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      setLocation("/settings/invites");
    };
    redirectInvitesHash();
    window.addEventListener("hashchange", redirectInvitesHash);
    return () => window.removeEventListener("hashchange", redirectInvitesHash);
  }, [setLocation]);

  useEffect(() => {
    setThemeState(getSavedTheme());
  }, []);

  const changeTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme);
    setTheme(newTheme);
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

  const sections = [
    { path: "/settings/notifications", label: "Уведомления", icon: Bell, color: "bg-orange-500" },
    { path: "/settings/stickers", label: "Стикеры", icon: Sticker, color: "bg-amber-500" },
    { path: "/settings/chat", label: "Чат и атмосфера", icon: Sparkles, color: "bg-violet-500" },
    { path: "/settings/media", label: "Камера и микрофон", icon: Video, color: "bg-rose-500" },
    { path: "/settings/privacy", label: "Приватность", icon: Lock, color: "bg-blue-500" },
    { path: "/settings/data", label: "Данные и память", icon: Database, color: "bg-green-500" },
    { path: "/settings/more", label: "Прочее", icon: MoreHorizontal, color: "bg-slate-500" },
  ] as const;

  return (
    <div className="flex h-full w-full max-w-full min-w-0 overflow-x-hidden justify-center bg-secondary/30">
      <PageTitle title="Настройки" />
      <div className="w-full max-w-full min-w-0 h-full flex flex-col bg-background overflow-y-auto overflow-x-hidden pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))]">
        <div className="uix-content-x py-4 glass z-10 sticky top-0 flex justify-between items-center">
          <span className="uix-text-title font-semibold">Настройки</span>
          <TapScaleButton
            type="button"
            subtle
            onClick={() => setLocation("/profile/edit")}
            className="text-primary font-medium text-[15px] min-h-[var(--uix-touch-min)] px-2 -mr-2 rounded-lg hover:bg-secondary/50 transition-colors"
            aria-label="Редактировать профиль"
          >
            Изм.
          </TapScaleButton>
        </div>

        <div className="p-4 flex flex-col gap-6 bg-secondary/20 flex-1">
          <TapScaleButton
            type="button"
            subtle
            onClick={() => setLocation("/settings/invites")}
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border/50 bg-card p-4 text-left shadow-sm hover:bg-secondary/30 min-h-[var(--uix-touch-min)]"
            aria-label="Пригласить друзей"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <span className="font-medium text-foreground">Пригласить друзей</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </TapScaleButton>

          <TapScaleDiv
            onClick={() => setLocation("/profile/me")}
            className="p-6 flex flex-col items-center justify-center border border-border/50 rounded-2xl bg-card cursor-pointer hover:bg-secondary/20 transition-colors duration-75 shadow-sm"
          >
            <div className="relative mb-4 group cursor-pointer inline-flex">
              <UserAvatar
                avatarUrl={user?.avatarUrl}
                displayName={user?.displayName ? [user.displayName, user.surname].filter(Boolean).join(" ") : undefined}
                seed={user?.id}
                size={96}
                className="w-24 h-24 border-2 border-background shadow-md group-hover:opacity-80 transition-opacity pointer-events-none"
                videoAlwaysActive
              />
              <TapScaleButton
                type="button"
                subtle
                haptic
                aria-label="Изменить аватар"
                className={cn(
                  "absolute bottom-0 right-0 z-10 flex items-center justify-center rounded-full border-0 bg-transparent p-0 shadow-none",
                  "min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] -m-1.5",
                  "hover:bg-transparent focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation("/profile/edit");
                }}
              >
                <span className="pointer-events-none flex shrink-0 rounded-full border-2 border-background bg-primary p-1.5 text-white shadow-sm">
                  <Camera className="h-4 w-4" aria-hidden />
                </span>
              </TapScaleButton>
            </div>
            <h2 className="text-2xl font-bold mb-1">
              {user?.displayName || user?.surname
                ? [user.displayName, user.surname].filter(Boolean).join(" ")
                : "Мой профиль"}
            </h2>
            <p className="text-muted-foreground text-[15px] mb-3 text-center max-w-sm">
              Номер телефона не показывается в приложении и не передаётся в запросах — только для входа.
            </p>
            <p className="text-[15px] text-center max-w-sm text-foreground/80 leading-snug">
              {(user as { bio?: string } | undefined)?.bio?.trim() || "Расскажите о себе в профиле."}
            </p>
          </TapScaleDiv>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-4">Оформление</h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => changeTheme("light")}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300",
                  theme === "light" ? "border-primary bg-primary/5" : "border-transparent bg-card shadow-sm hover:scale-95",
                )}
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 mb-1">
                  <Sun className="w-5 h-5" />
                </div>
                <span className={cn("text-[13px] font-medium", theme === "light" ? "text-primary" : "text-foreground")}>
                  Светлая
                </span>
              </button>

              <button
                type="button"
                onClick={() => changeTheme("dark")}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300",
                  theme === "dark" ? "border-primary bg-primary/5" : "border-transparent bg-card shadow-sm hover:scale-95",
                )}
              >
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 mb-1">
                  <Moon className="w-5 h-5" />
                </div>
                <span className={cn("text-[13px] font-medium", theme === "dark" ? "text-primary" : "text-foreground")}>
                  Тёмная
                </span>
              </button>

              <button
                type="button"
                onClick={() => changeTheme("fitfin")}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden",
                  theme === "fitfin"
                    ? "border-[#FF6B35] bg-[#FF6B35]/5"
                    : "border-transparent bg-card shadow-sm hover:scale-95",
                )}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FF6B35] to-[#FF9F1C] flex items-center justify-center text-white mb-1 shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span
                  className={cn("text-[13px] font-medium", theme === "fitfin" ? "text-[#FF6B35]" : "text-foreground")}
                >
                  Фитфин
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-4">Разделы</h3>
            <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm">
              {sections.map((item, j) => (
                <TapScaleButton
                  key={item.path}
                  type="button"
                  subtle
                  onClick={() => setLocation(item.path)}
                  className={cn(
                    "uix-list-row flex w-full items-center justify-between p-3.5 text-left hover:bg-secondary/50 cursor-pointer transition-colors duration-75 min-h-[var(--uix-touch-min)] rounded-none shadow-none border-0 font-normal",
                    j < sections.length - 1 && "border-b border-border/50",
                  )}
                  aria-label={item.label}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0", item.color)}
                    >
                      <item.icon className="w-4 h-4" />
                    </div>
                    <span className="text-[16px] font-medium truncate">{item.label}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0" />
                </TapScaleButton>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm">
            <TapScaleButton
              type="button"
              subtle
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 min-h-[var(--uix-touch-min)] p-4 text-red-500 hover:bg-red-500/10 transition-colors duration-75 font-medium rounded-none shadow-none border-0"
            >
              <LogOut className="w-5 h-5" />
              Выйти из аккаунта
            </TapScaleButton>
            <TapScaleButton
              type="button"
              subtle
              onClick={() => setDeleteDialogOpen(true)}
              className="w-full flex items-center justify-center gap-2 min-h-[var(--uix-touch-min)] p-4 text-muted-foreground hover:bg-secondary/50 transition-colors duration-75 text-sm rounded-none shadow-none border-0 border-t border-border/50 font-normal"
            >
              <Trash2 className="w-4 h-4" />
              Удалить аккаунт
            </TapScaleButton>
          </div>
        </div>
      </div>

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
                void handleDeleteAccountConfirm();
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
  );
}
