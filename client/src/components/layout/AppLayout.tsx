import { useLocation } from "wouter";
import { MessageCircle, Rss, Users, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();

  const navItems = [
    { id: "chats", path: "/", icon: MessageCircle, label: "Чаты" },
    { id: "posts", path: "/posts", icon: Rss, label: "Лента" },
    { id: "contacts", path: "/contacts", icon: Users, label: "Контакты" },
    { id: "settings", path: "/settings", icon: SettingsIcon, label: "Настройки" },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Desktop/Tablet Sidebar */}
      <aside className="hidden md:flex flex-col w-20 lg:w-64 border-r border-border/50 bg-card/30 backdrop-blur-xl z-20">
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <MessageCircle className="text-white w-6 h-6" />
          </div>
          <span className="hidden lg:block ml-3 font-semibold text-lg tracking-tight">Native</span>
        </div>
        
        <nav className="flex-1 flex flex-col gap-2 px-3">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setLocation(item.path)}
                className={cn(
                  "flex items-center justify-center lg:justify-start p-3 lg:px-4 rounded-2xl transition-all duration-200 group",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
                data-testid={`nav-${item.id}`}
              >
                <Icon className={cn("w-6 h-6 transition-transform duration-200", isActive && "scale-110")} />
                <span className={cn(
                  "hidden lg:block ml-3 font-medium text-sm transition-colors",
                  isActive ? "text-primary font-semibold" : ""
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 flex justify-center lg:justify-start lg:px-6">
          <img 
            src="https://i.pravatar.cc/150?u=a042581f4e29026704d" 
            alt="Avatar" 
            className="w-10 h-10 rounded-full border border-border cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setLocation("/settings")}
            data-testid="nav-profile-avatar"
          />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col h-full overflow-hidden w-full max-w-[100vw]">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden absolute bottom-0 left-0 right-0 glass pb-safe z-50">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setLocation(item.path)}
                className="flex flex-col items-center justify-center w-full h-full space-y-1 relative"
                data-testid={`mobile-nav-${item.id}`}
              >
                <div className={cn(
                  "absolute inset-0 bg-primary/10 rounded-2xl scale-0 transition-transform duration-300",
                  isActive && "scale-100 opacity-100 w-12 h-8 m-auto -translate-y-3"
                )} />
                <Icon className={cn(
                  "w-6 h-6 transition-all duration-300 relative z-10", 
                  isActive ? "text-primary -translate-y-1" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-[10px] font-medium transition-all duration-300 absolute bottom-2",
                  isActive ? "text-primary opacity-100 translate-y-0" : "text-muted-foreground opacity-100"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}