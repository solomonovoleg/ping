import { useLocation } from "wouter";
import { LayoutDashboard, Users, Shield, History, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { path: "/admin", label: "Дашборд", icon: LayoutDashboard },
  { path: "/admin/users", label: "Пользователи", icon: Users },
  { path: "/admin/admins", label: "Админы", icon: Shield },
  { path: "/admin/audit", label: "Аудит", icon: History },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  return (
    <div className="min-h-full flex flex-col bg-background w-full max-w-full min-w-0 overflow-x-hidden">
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
      </header>
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Мобильная навигация */}
        <nav className="md:hidden border-b border-border/50 px-2 py-2 flex gap-2 overflow-x-auto bg-muted/30">
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
        <aside className="hidden md:flex w-56 shrink-0 border-r border-border/50 p-2 flex-col gap-1 bg-muted/20">
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
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4">{children}</main>
      </div>
    </div>
  );
}
