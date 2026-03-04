import { useState } from "wouter";
import { Search, Edit, MoreHorizontal, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock Data
const FOLDERS = [
  { id: "all", name: "Все чаты", count: 0 },
  { id: "unread", name: "Новые", count: 3 },
  { id: "personal", name: "Личное", count: 0 },
  { id: "work", name: "Работа", count: 12 },
];

const CHATS = [
  {
    id: 1,
    name: "Алиса Смирнова",
    avatar: "https://i.pravatar.cc/150?u=1",
    lastMessage: "Давай встретимся в 19:00 у входа?",
    time: "14:23",
    unread: 2,
    online: true,
    folder: "personal",
    typing: false,
  },
  {
    id: 2,
    name: "Команда Дизайна",
    avatar: "https://i.pravatar.cc/150?u=2",
    lastMessage: "Максим: Я обновил макеты в фигме",
    time: "11:45",
    unread: 0,
    online: false,
    folder: "work",
    typing: true,
  },
  {
    id: 3,
    name: "Product Sync",
    avatar: "https://i.pravatar.cc/150?u=3",
    lastMessage: "Созвон через 10 минут, ссылка в описании.",
    time: "Вчера",
    unread: 5,
    online: false,
    folder: "work",
    typing: false,
  },
  {
    id: 4,
    name: "Мама",
    avatar: "https://i.pravatar.cc/150?u=4",
    lastMessage: "Как дела на работе? Не забудь покушать!",
    time: "Вчера",
    unread: 0,
    online: true,
    folder: "personal",
    typing: false,
    read: true
  },
  {
    id: 5,
    name: "Telegram News",
    avatar: "https://i.pravatar.cc/150?u=5",
    lastMessage: "Новое обновление уже доступно для всех пользователей...",
    time: "Пн",
    unread: 12,
    online: false,
    folder: "all",
    typing: false,
  },
  {
    id: 6,
    name: "Иван Разработчик",
    avatar: "https://i.pravatar.cc/150?u=6",
    lastMessage: "Пулл реквест заапрувил, можешь мержить.",
    time: "Пн",
    unread: 0,
    online: false,
    folder: "work",
    typing: false,
    read: true
  },
];

export default function Chats() {
  const [activeFolder, setActiveFolder] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChats = CHATS.filter(chat => {
    const matchesFolder = activeFolder === "all" || 
                         (activeFolder === "unread" && chat.unread > 0) ||
                         chat.folder === activeFolder;
    const matchesSearch = chat.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  return (
    <div className="flex h-full w-full">
      {/* Chats List Panel */}
      <div className="w-full md:w-[350px] lg:w-[400px] flex flex-col h-full bg-background border-r border-border/50">
        
        {/* Header */}
        <div className="px-4 pt-6 pb-2 glass z-10 sticky top-0">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold tracking-tight">Чаты</h1>
            <button className="p-2 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
              <Edit className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Поиск" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-secondary/50 border-none rounded-xl py-2.5 pl-10 pr-4 text-[15px] focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/70 outline-none"
            />
          </div>

          {/* Folders (Scrollable) */}
          <div className="flex overflow-x-auto hide-scrollbar pb-2 -mx-4 px-4 gap-2">
            {FOLDERS.map(folder => (
              <button
                key={folder.id}
                onClick={() => setActiveFolder(folder.id)}
                className={cn(
                  "whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                  activeFolder === folder.id 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {folder.name}
                {folder.count > 0 && activeFolder !== folder.id && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px]">
                    {folder.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chats List */}
        <div className="flex-1 overflow-y-auto pb-24 md:pb-0">
          {filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
              <MessageCircle className="w-12 h-12 mb-4 opacity-20" />
              <p>Нет чатов, соответствующих фильтру</p>
            </div>
          ) : (
            <div className="px-2 py-2">
              {filteredChats.map((chat) => (
                <div 
                  key={chat.id}
                  className="flex items-center gap-3 p-3 rounded-2xl hover:bg-secondary/50 transition-colors cursor-pointer active:scale-[0.98]"
                >
                  <div className="relative flex-shrink-0">
                    <img 
                      src={chat.avatar} 
                      alt={chat.name} 
                      className="w-14 h-14 rounded-full object-cover"
                    />
                    {chat.online && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="font-semibold text-[16px] truncate pr-2">{chat.name}</h3>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{chat.time}</span>
                    </div>
                    
                    <div className="flex justify-between items-center gap-2">
                      <p className={cn(
                        "text-[14px] truncate",
                        chat.typing ? "text-primary" : "text-muted-foreground"
                      )}>
                        {chat.typing ? "Печатает..." : chat.lastMessage}
                      </p>
                      
                      {chat.unread > 0 ? (
                        <div className="flex-shrink-0 min-w-[20px] h-[20px] px-1.5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[11px] font-bold">
                          {chat.unread}
                        </div>
                      ) : chat.read ? (
                        <CheckCheck className="w-4 h-4 text-primary flex-shrink-0" />
                      ) : (
                        <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Placeholder for Chat Content (Desktop only) */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-secondary/20">
        <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-6 shadow-sm">
          <MessageCircle className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Выберите чат</h2>
        <p className="text-muted-foreground max-w-sm text-center">
          Выберите собеседника из списка слева, чтобы начать общение
        </p>
      </div>
    </div>
  );
}