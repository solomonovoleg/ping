import { 
  Bell, 
  Moon, 
  Lock, 
  Database, 
  Palette, 
  HelpCircle, 
  LogOut,
  ChevronRight,
  Camera
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    title: "Внешний вид",
    items: [
      { icon: Palette, label: "Оформление", color: "bg-purple-500" },
      { icon: Moon, label: "Ночной режим", color: "bg-indigo-500", action: "toggle" },
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
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&crop=face" 
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

        {/* Settings Groups */}
        <div className="p-4 flex flex-col gap-6 bg-secondary/20 flex-1">
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