import { useLocation } from "wouter";
import { MessageCircle, LayoutDashboard, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import feedIcon from "@/assets/images/feed-icon.png";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();

  const navItems = [
    { id: "chats", path: "/", icon: MessageCircle, label: "Чаты" },
    { id: "posts", path: "/posts", customIcon: feedIcon, label: "Лента" },
    { id: "board", path: "/board", icon: LayoutDashboard, label: "Борд" },
    { id: "settings", path: "/settings", icon: SettingsIcon, label: "Настройки" },
  ];

  return (
    <div className="flex h-screen w-full bg-secondary/30 items-center justify-center overflow-hidden">
      {/* Mobile Device Wrapper for Desktop / Full width on mobile */}
      <div className="relative w-full h-full sm:w-[390px] sm:h-[844px] sm:max-h-[95vh] sm:rounded-[3rem] sm:border-[8px] sm:border-foreground/10 bg-background overflow-hidden sm:shadow-2xl flex flex-col">
        
        {/* Dynamic Island / Notch Placeholder (Desktop only) */}
        <div className="hidden sm:flex absolute top-0 inset-x-0 h-7 z-50 justify-center pointer-events-none">
          <div className="w-32 h-7 bg-foreground/10 rounded-b-3xl"></div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 relative flex flex-col h-full overflow-hidden w-full sm:pt-6">
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="absolute bottom-0 left-0 right-0 glass pb-safe z-50 border-t border-border/50">
          <div className="flex justify-around items-center h-16 px-2 sm:pb-2 sm:h-20">
            {navItems.map((item) => {
              const isActive = location === item.path;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setLocation(item.path)}
                  className="flex flex-col items-center justify-center w-full h-full pt-1 pb-1 gap-1 relative"
                  data-testid={`mobile-nav-${item.id}`}
                >
                  <div className="relative flex items-center justify-center w-14 h-8">
                    <div className={cn(
                      "absolute inset-0 bg-primary/10 rounded-full scale-0 transition-transform duration-200",
                      isActive && "scale-100"
                    )} />
                    {item.customIcon ? (
                      <img 
                        src={item.customIcon} 
                        alt={item.label}
                        className={cn(
                          "w-6 h-6 object-contain transition-all duration-200 relative z-10",
                          !isActive && "opacity-60 grayscale"
                        )}
                      />
                    ) : Icon && (
                      <Icon className={cn(
                        "w-6 h-6 transition-colors duration-200 relative z-10", 
                        isActive ? "text-primary" : "text-muted-foreground"
                      )} />
                    )}
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium transition-colors duration-200",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}