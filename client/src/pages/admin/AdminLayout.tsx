import { useState, useEffect, type ReactNode } from "react";
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
  Activity,
  PhoneCall,
  HardDrive,
  MessageSquareText,
  Download,
  Sparkles,
  BookOpen,
  Globe,
  Clapperboard,
  ChevronRight,
  Scale,
  SlidersHorizontal,
  MessagesSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";
import { AdminShellProvider } from "@/features/admin-shell";
import "@/features/admin-shell/admin-shell.css";
import { isAdminModerationNavActive } from "@/lib/admin-moderation-nav";
import { formatAdminNavBadgeCount, useAdminNavBadges } from "@/lib/admin-nav-badges";

const STORAGE_KEY = "ping:admin-desktop-mode";

function getDesktopMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
    return window.matchMedia("(min-width: 1024px)").matches;
  } catch {
    return false;
  }
}

type AdminNavItem = {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  mobilePriority?: boolean;
  requiresMediaStudio?: boolean;
};

type AdminShellQuickAction = {
  label: string;
  path: string;
};

type AdminNavSection = {
  id: string;
  label: string;
  items: readonly AdminNavItem[];
};

const NAV_SECTIONS: readonly AdminNavSection[] = [
  {
    id: "overview",
    label: "Обзор",
    items: [
      { path: "/admin", label: "Дашборд", icon: LayoutDashboard, mobilePriority: true },
      { path: "/admin/monitors", label: "Мониторы", icon: Activity, mobilePriority: true },
      { path: "/admin/new-tel-calls", label: "New-Tel звонки", icon: PhoneCall, mobilePriority: true },
      { path: "/admin/disk", label: "Диск", icon: HardDrive },
    ],
  },
  {
    id: "users",
    label: "Пользователи",
    items: [
      { path: "/admin/users", label: "Пользователи", icon: Users, mobilePriority: true },
      { path: "/admin/referrals", label: "Пригласительные", icon: Ticket, mobilePriority: true },
      { path: "/admin/admins", label: "Админы", icon: Shield },
      { path: "/admin/audit", label: "Аудит", icon: History },
    ],
  },
  {
    id: "content",
    label: "Контент и каналы",
    items: [
      { path: "/admin/help-pages", label: "Справки", icon: BookOpen },
      { path: "/admin/seo", label: "SEO", icon: Globe },
      { path: "/admin/service-chat", label: "Service Chat", icon: MessageSquareText },
      { path: "/admin/vk-parser", label: "Парсер ВК", icon: Download },
      { path: "/admin/edge-companion", label: "EDGE Companion", icon: Sparkles },
      { path: "/admin/media-studio", label: "Медиа-студия", icon: Clapperboard, requiresMediaStudio: true },
      { path: "/admin/group-chats", label: "Групповые чаты", icon: MessagesSquare },
    ],
  },
  {
    id: "moderation",
    label: "Модерация и сторы",
    items: [{ path: "/admin/moderation", label: "Модерация", icon: Scale, mobilePriority: true }],
  },
  {
    id: "platform",
    label: "Платформа",
    items: [
      { path: "/admin/ops", label: "Операции", icon: SlidersHorizontal, mobilePriority: true },
      { path: "/admin/settings", label: "Настройки", icon: Settings },
    ],
  },
] as const;

function buildNavSections(showMediaStudio: boolean): AdminNavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.requiresMediaStudio || showMediaStudio),
  })).filter((section) => section.items.length > 0);
}

export default function AdminLayout({
  children,
  showMediaStudioNav = false,
  user = null,
}: {
  children: ReactNode;
  /** Пункт «Медиа-студия» только для admin / super_admin (сервер тоже режет moderator). */
  showMediaStudioNav?: boolean;
  user?: AuthUser | null;
}) {
  const navSections = buildNavSections(showMediaStudioNav);
  const navItems = navSections.flatMap((section) => section.items);
  const mobileNavItems = navItems.filter((item) => item.mobilePriority);
  const [location, setLocation] = useLocation();
  const [desktopMode, setDesktopMode] = useState(getDesktopMode);
  const navItemActive = (itemPath: string) =>
    itemPath === "/admin/moderation" ? isAdminModerationNavActive(location) : location === itemPath;

  const { counts: navBadgeCounts } = useAdminNavBadges(user?.id, location);

  function navBadgeForPath(path: string): string {
    if (path === "/admin/users") return formatAdminNavBadgeCount(navBadgeCounts.newUsers);
    if (path === "/admin/media-studio") return formatAdminNavBadgeCount(navBadgeCounts.mediaStudioPublished);
    if (path === "/admin/moderation") return formatAdminNavBadgeCount(navBadgeCounts.openReports);
    return "";
  }

  useEffect(() => {
    setDesktopMode(getDesktopMode());
  }, []);

  const toggleDesktop = () => {
    const next = !desktopMode;
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {}
    setDesktopMode(next);
  };

  const forceDesktop = desktopMode;
  const activeNavItemLabel = navItems.find((item) => navItemActive(item.path))?.label ?? "Раздел";
  const activeNavSection =
    navSections.find((section) => section.items.some((item) => navItemActive(item.path))) ?? null;
  const activeNavItem = navItems.find((item) => navItemActive(item.path)) ?? null;
  const breadcrumbs = [
    { label: "Админка", path: "/admin" },
    ...(activeNavSection ? [{ label: activeNavSection.label, path: activeNavSection.items[0]?.path }] : []),
    ...(activeNavItem ? [{ label: activeNavItem.label }] : []),
  ];
  const quickActions: AdminShellQuickAction[] = activeNavSection
    ? activeNavSection.items
        .filter((item) => item.path !== activeNavItem?.path)
        .slice(0, 4)
        .map((item) => ({ label: item.label, path: item.path }))
    : [];

  const navButtonClass = (active: boolean) =>
    cn(
      "admin-nav-item flex w-full min-h-[var(--uix-touch-min)] items-center gap-2 px-3 py-2.5 text-left text-sm font-medium border border-transparent",
      active ? "admin-nav-item-active" : "",
    );

  return (
    <AdminShellProvider user={user} breadcrumbs={breadcrumbs} quickActions={quickActions}>
      <div
        data-admin-shell
        className="admin-surface-page h-dvh flex w-full max-w-full min-w-0 flex-col overflow-hidden text-foreground"
      >
        {/* Мобильный верх: только когда колонка меню скрыта */}
        <div
          className={cn(
            "admin-header-bar flex shrink-0 items-center justify-between gap-2 px-3 py-2.5 sm:px-4",
            forceDesktop ? "hidden" : "flex"
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[hsl(var(--admin-muted))] transition-colors hover:bg-[hsl(var(--admin-elevated-strong)/0.45)] hover:text-[hsl(210_20%_96%)]"
              aria-label="Назад в приложение"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[11px] uppercase tracking-wide text-[hsl(var(--admin-muted))]">Админ-панель</p>
              <p className="truncate text-sm font-semibold text-[hsl(210_20%_98%)]">{activeNavItemLabel}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={toggleDesktop}
              className="flex min-h-[var(--uix-touch-min)] items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm text-[hsl(var(--admin-muted))] transition-colors hover:bg-[hsl(var(--admin-elevated-strong)/0.35)] hover:text-[hsl(210_20%_96%)]"
              title="Боковое меню (как на десктопе)"
              aria-label="Включить вид с меню слева"
            >
              <Monitor className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline text-xs">Меню</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await logout();
                window.location.href = "/admin";
              }}
              className="admin-logout-btn flex min-h-[var(--uix-touch-min)] items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors"
              aria-label="Выйти"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        </div>

        <div className={cn("flex min-h-0 flex-1 overflow-hidden", forceDesktop ? "flex-row" : "flex-col")}>
          <nav
            className={cn(
              "flex gap-2 overflow-x-auto border-b px-2 py-2 shrink-0",
              "border-[hsl(var(--admin-border)/0.35)] bg-[hsl(var(--admin-sidebar)/0.35)]",
              forceDesktop ? "hidden" : "flex"
            )}
          >
            {mobileNavItems.map(({ path, label }) => {
              const active = navItemActive(path);
              const badge = navBadgeForPath(path);
              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => setLocation(path)}
                  aria-current={active ? "page" : undefined}
                  aria-label={
                    badge ? `${label}, новых событий: ${badge.replace(/^\+/, "")}` : undefined
                  }
                  className={cn(
                    "flex-shrink-0 rounded-full px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors min-h-[36px] inline-flex items-center gap-1.5",
                    active
                      ? "bg-[hsl(var(--admin-accent)/0.35)] text-[hsl(var(--admin-accent-foreground))] ring-1 ring-[hsl(var(--admin-accent)/0.4)]"
                      : "bg-[hsl(var(--admin-elevated)/0.4)] text-[hsl(var(--admin-muted))] hover:text-[hsl(210_20%_92%)]",
                  )}
                >
                  {label}
                  {badge ? (
                    <span
                      className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 px-1 py-0.5 text-[9px] font-bold leading-none text-white tabular-nums"
                      aria-hidden
                    >
                      {badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <aside
            className={cn(
              "admin-surface-sidebar flex w-[260px] shrink-0 flex-col border-r",
              forceDesktop ? "flex" : "hidden"
            )}
          >
            <div className="flex flex-col gap-1 border-b border-[hsl(var(--admin-border)/0.35)] p-3">
              <button
                type="button"
                onClick={() => setLocation("/")}
                className="flex items-center gap-2 rounded-[var(--admin-radius-md)] px-2 py-2 text-sm text-[hsl(var(--admin-muted))] transition-colors hover:bg-[hsl(var(--admin-elevated-strong)/0.4)] hover:text-[hsl(210_20%_96%)]"
                aria-label="Назад в приложение"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                В приложение
              </button>
              <div className="px-2 pt-1">
                <p className="text-xs font-medium uppercase tracking-wider admin-text-muted">Панель</p>
                <p className="text-lg font-semibold leading-tight text-[hsl(210_20%_98%)]">Админ-панель</p>
              </div>
            </div>

            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-2">
              {navSections.map((section) => (
                <div key={section.id} className="mb-2 space-y-0.5">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--admin-muted))]">
                    {section.label}
                  </p>
                  {section.items.map(({ path, label, icon: Icon }) => {
                    const active = navItemActive(path);
                    const badge = navBadgeForPath(path);
                    return (
                      <button
                        key={path}
                        type="button"
                        onClick={() => setLocation(path)}
                        aria-current={active ? "page" : undefined}
                        aria-label={
                          badge
                            ? `${label}, новых событий: ${badge.replace(/^\+/, "")}`
                            : undefined
                        }
                        className={navButtonClass(active)}
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-90" />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        {badge ? (
                          <span
                            className="inline-flex min-w-[22px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm tabular-nums"
                            aria-hidden
                          >
                            {badge}
                          </span>
                        ) : null}
                        {active ? <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden /> : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-1 border-t border-[hsl(var(--admin-border)/0.35)] p-2">
              <button
                type="button"
                onClick={toggleDesktop}
                className={cn(
                  "admin-nav-item flex w-full min-h-[var(--uix-touch-min)] items-center gap-2 px-3 py-2.5 text-left text-sm font-medium",
                  forceDesktop ? "text-[hsl(262_75%_72%)]" : ""
                )}
                title={forceDesktop ? "Переключить на мобильный вид навигации" : "Показать боковую колонку на широком экране"}
                aria-label={forceDesktop ? "Мобильный вид меню" : "Десктоп-вид меню"}
              >
                {forceDesktop ? <Smartphone className="h-4 w-4 shrink-0" /> : <Monitor className="h-4 w-4 shrink-0" />}
                {forceDesktop ? "Мобильный вид" : "Десктоп-меню"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  window.location.href = "/admin";
                }}
                className="admin-logout-btn flex w-full min-h-[var(--uix-touch-min)] items-center gap-2 rounded-[var(--admin-radius-md)] px-3 py-2.5 text-left text-sm font-medium transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Выйти
              </button>
            </div>
          </aside>

          <main className="admin-surface-main min-h-0 min-w-0 flex-1 basis-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6 lg:p-8">
            <div className="h-full min-h-0 min-w-0 w-full max-w-full">{children}</div>
          </main>
        </div>

      </div>
    </AdminShellProvider>
  );
}
