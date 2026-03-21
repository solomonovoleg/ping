import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  Shield,
  History,
  ArrowLeft,
  Ticket,
  Settings,
  LogOut,
  Monitor,
  Smartphone,
  SlidersHorizontal,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth";

const STORAGE_KEY = "ping:admin-desktop-mode";

function getDesktopMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

const NAV = [
  { path: "/admin", label: "Дашборд", icon: LayoutDashboard },
  { path: "/admin/monitors", label: "Мониторы", icon: Activity },
  { path: "/admin/users", label: "Пользователи", icon: Users },
  { path: "/admin/referrals", label: "Пригласительные", icon: Ticket },
  { path: "/admin/admins", label: "Админы", icon: Shield },
  { path: "/admin/settings", label: "Настройки", icon: Settings },
  { path: "/admin/ops", label: "Операции", icon: SlidersHorizontal },
  { path: "/admin/audit", label: "Аудит", icon: History },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [desktopMode, setDesktopMode] = useState(getDesktopMode);

  useEffect(() => {
    setDesktopMode(getDesktopMode());
  }, []);

  const toggleDesktop = () => {
    const next = !desktopMode;
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "");
    } catch {}
    setDesktopMode(next);
  };

  const forceDesktop = desktopMode;

  return (
    <div className="h-dvh flex flex-col bg-background w-full max-w-full min-w-0 overflow-x-hidden">
      <header className="border-b border-border/50 px-4 py-3 flex items-center justify-between gap-4 bg-card/50 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Назад в приложение"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-lg">Админ-панель</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleDesktop}
            className={cn(
              "p-2 rounded-lg flex items-center gap-1.5 text-sm",
              forceDesktop ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title={forceDesktop ? "Десктоп-режим включён. Тап — мобильный вид" : "Мобильный вид. Тап — десктоп"}
            aria-label={forceDesktop ? "Переключить на мобильный вид" : "Переключить на десктоп"}
          >
            {forceDesktop ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
            <span className="hidden sm:inline text-xs">{forceDesktop ? "Десктоп" : "Мобильный"}</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              await logout();
              window.location.href = "/admin";
            }}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm"
            aria-label="Выйти"
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </button>
        </div>
      </header>
      <div className={cn("flex flex-1 min-h-0 overflow-hidden", forceDesktop ? "flex-row" : "flex-col")}>
        {/* Мобильная навигация — видна только в мобильном режиме */}
        <nav className={cn(
          "border-b border-border/50 px-2 py-2 flex gap-2 overflow-x-auto bg-muted/30 shrink-0",
          forceDesktop ? "hidden" : "flex"
        )}>
          {NAV.map(({ path, label }) => (
            <button
              key={path}
              type="button"
              onClick={() => setLocation(path)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap",
                location === path
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </nav>
        <aside className={cn(
          "w-56 shrink-0 border-r border-border/50 p-2 flex-col gap-1 bg-muted/20",
          forceDesktop ? "flex" : "hidden"
        )}>
          {NAV.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              type="button"
              onClick={() => setLocation(path)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors",
                location === path
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </aside>
        <main className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden p-6 overscroll-contain">
          <div className={cn("mx-auto", forceDesktop ? "max-w-6xl" : "max-w-4xl")}>{children}</div>
        </main>
      </div>
    </div>
  );
}
