import { useState, useEffect } from "react";
import { 
  Bell, 
  Lock, 
  Database, 
  Palette, 
  HelpCircle, 
  LogOut,
  ChevronRight,
  Camera,
  Sun,
  Moon,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

import avatarMain from "@/assets/images/avatar-main.png";

const SETTINGS_GROUPS = [
  {
    title: "Основные",
    items: [
      { icon: Bell, label: "Уведомления и звуки", color: "bg-orange-500" },
      { icon: Lock, label: "Конфиденциальность", color: "bg-blue-500" },
      { icon: Database, label: "Данные и память", color: "bg-green-500" },
    ]
  },
  {
    title: "Прочее",
    items: [
      { icon: HelpCircle, label: "Помощь", color: "bg-teal-500" },
    ]
  }
];

export default function Settings() {
  const [theme, setTheme] = useState("light");

  // Sync state with actual DOM class on mount
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    const isFitfin = document.documentElement.classList.contains("theme-fitfin");
    
    if (isFitfin) setTheme("fitfin");
    else if (isDark) setTheme("dark");
    else setTheme("light");
  }, []);

  const changeTheme = (newTheme: string) => {
    setTheme(newTheme);
    document.documentElement.classList.remove("dark", "theme-fitfin");
    
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (newTheme === "fitfin") {
      document.documentElement.classList.add("theme-fitfin");
    }
  };

  return (
    <div className="flex h-full w-full justify-center bg-secondary/30">
      <div className="w-full h-full flex flex-col bg-background overflow-y-auto pb-24 sm:pb-28">
        
        {/* Header */}
        <div className="px-4 py-4 glass z-10 sticky top-0 flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">Настройки</h1>
          <button className="text-primary font-medium text-[15px]">Изм.</button>
        </div>

        {/* Profile Section */}
        <div className="p-6 flex flex-col items-center justify-center border-b border-border/30 bg-card">
          <div className="relative mb-4 group cursor-pointer">
            <img 
              src={avatarMain} 
              alt="Avatar" 
              className="w-24 h-24 rounded-full object-cover border-2 border-background shadow-md group-hover:opacity-80 transition-opacity"
            />
            <div className="absolute bottom-0 right-0 p-1.5 bg-primary rounded-full text-white shadow-sm border-2 border-background">
              <Camera className="w-4 h-4" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mb-1">Александр Дизайнов</h2>
          <p className="text-muted-foreground text-[15px] mb-3">+7 (999) 123-45-67</p>
          <p className="text-[15px] text-center max-w-sm text-foreground/80 leading-snug">
            Создаю интерфейсы, которые не хочется закрывать. 
            Пишите по любым вопросам.
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
                <span className={cn("text-[13px] font-medium", theme === 'light' ? "text-primary" : "text-foreground")}>Светлая</span>
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
                <span className={cn("text-[13px] font-medium", theme === 'dark' ? "text-primary" : "text-foreground")}>Тёмная</span>
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
                <span className={cn("text-[13px] font-medium", theme === 'fitfin' ? "text-[#FF6B35]" : "text-foreground")}>Фитфин</span>
              </button>
            </div>
          </div>

          {/* Settings Groups */}
          {SETTINGS_GROUPS.map((group, i) => (
            <div key={i}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-4">
                {group.title}
              </h3>
              <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm">
                {group.items.map((item, j) => (
                  <div 
                    key={j} 
                    className={cn(
                      "flex items-center justify-between p-3.5 hover:bg-secondary/50 cursor-pointer transition-colors active:bg-secondary",
                      j !== group.items.length - 1 && "border-b border-border/50"
                    )}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white", item.color)}>
                        <item.icon className="w-4 h-4" />
                      </div>
                      <span className="text-[16px] font-medium">{item.label}</span>
                    </div>
                    
                    {item.action === "toggle" ? (
                      <div className="w-12 h-6 bg-primary/20 rounded-full relative cursor-pointer">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-primary rounded-full shadow-sm"></div>
                      </div>
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Logout Button */}
          <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm mt-2">
            <button className="w-full flex items-center justify-center gap-2 p-4 text-red-500 hover:bg-red-500/10 transition-colors font-medium">
              <LogOut className="w-5 h-5" />
              Выйти из аккаунта
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
}