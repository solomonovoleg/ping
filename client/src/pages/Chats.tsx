import { useState, useRef, useEffect } from "react";
import { Search, Edit, Check, CheckCheck, MessageCircle, Phone, Video, X, UserPlus, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

import avatarAlisa from "@/assets/images/avatar-alisa.png";
import avatarDesign from "@/assets/images/avatar-design.png";
import avatarProduct from "@/assets/images/avatar-product.png";
import avatarMom from "@/assets/images/avatar-mom.png";
import avatarNews from "@/assets/images/avatar-news.png";
import avatarIvan from "@/assets/images/avatar-ivan.png";

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
    avatar: avatarAlisa,
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
    avatar: avatarDesign,
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
    avatar: avatarProduct,
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
    avatar: avatarMom,
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
    avatar: avatarNews,
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
    avatar: avatarIvan,
    lastMessage: "Пулл реквест заапрувил, можешь мержить.",
    time: "Пн",
    unread: 0,
    online: false,
    folder: "work",
    typing: false,
    read: true
  },
];

const CONTACTS = [
  { id: 101, name: "Алексей Иванов", status: "был(а) недавно", avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&h=150&fit=crop&crop=face", letter: "А" },
  { id: 102, name: "Алиса Смирнова", status: "в сети", avatar: avatarAlisa, letter: "А" },
  { id: 103, name: "Борис Ельцин", status: "был(а) в 14:00", avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&h=150&fit=crop&crop=face", letter: "Б" },
  { id: 104, name: "Виктория Секрет", status: "в сети", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face", letter: "В" },
  { id: 105, name: "Григорий Лепс", status: "был(а) вчера", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face", letter: "Г" },
  { id: 106, name: "Дмитрий Нагиев", status: "в сети", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face", letter: "Д" },
  { id: 107, name: "Елена Ваенга", status: "печатает...", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face", letter: "Е" },
  { id: 108, name: "Иван Разработчик", status: "в сети", avatar: avatarIvan, letter: "И" },
  { id: 109, name: "Мама", status: "в сети", avatar: avatarMom, letter: "М" },
];

export default function Chats() {
  const [activeFolder, setActiveFolder] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search logic
  const isSearching = isSearchFocused || searchQuery.length > 0;
  const searchLower = searchQuery.toLowerCase();
  
  const filteredChats = CHATS.filter(chat => {
    if (searchQuery.length > 0) {
      return chat.name.toLowerCase().includes(searchLower) || chat.lastMessage.toLowerCase().includes(searchLower);
    }
    return activeFolder === "all" || 
          (activeFolder === "unread" && chat.unread > 0) ||
          chat.folder === activeFolder;
  });

  const filteredContacts = CONTACTS.filter(contact => 
    contact.name.toLowerCase().includes(searchLower)
  );

  return (
    <div className="flex h-full w-full">
      <div className="w-full flex flex-col h-full bg-background relative">
        
        {/* Header (Hidden when searching to save space) */}
        <div className={cn(
          "px-4 pt-6 pb-2 glass z-20 sticky top-0 transition-all duration-300",
          isSearching ? "pt-4 pb-4 bg-background/95 border-b-transparent shadow-none" : "border-b border-border/50"
        )}>
          
          <div className={cn(
            "flex justify-between items-center overflow-hidden transition-all duration-300",
            isSearching ? "h-0 mb-0 opacity-0" : "h-8 mb-4 opacity-100"
          )}>
            <h1 className="text-2xl font-bold tracking-tight">Чаты</h1>
            <button className="p-2 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
              <Edit className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 group">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                ref={inputRef}
                type="text" 
                placeholder="Поиск или новый чат..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                className="w-full bg-secondary/50 border-none rounded-xl py-2.5 pl-10 pr-10 text-[15px] focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/70 outline-none"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted-foreground/20 flex items-center justify-center text-muted-foreground hover:bg-muted-foreground/30 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            
            {isSearching && (
              <button 
                onClick={() => {
                  setIsSearchFocused(false);
                  setSearchQuery("");
                  inputRef.current?.blur();
                }}
                className="text-[15px] font-medium text-primary px-2 animate-in fade-in slide-in-from-right-4"
              >
                Отмена
              </button>
            )}
          </div>

          {/* Folders (Scrollable) */}
          {!isSearching && (
            <div className="flex overflow-x-auto hide-scrollbar pt-4 -mx-4 px-4 gap-2 animate-in fade-in slide-in-from-top-2">
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
          )}
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto pb-24 sm:pb-28">
          
          {/* SEARCH OVERLAY */}
          {isSearching ? (
            <div className="animate-in fade-in duration-200 px-2">
              
              {/* Quick Contacts (When not typing) */}
              {searchQuery.length === 0 && (
                <div className="mb-4 pt-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 ml-2">
                    Недавние контакты
                  </h3>
                  <div className="flex overflow-x-auto hide-scrollbar -mx-2 px-2 pb-2 gap-4">
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary transition-transform active:scale-95">
                        <UserPlus className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] font-medium text-primary">Новый</span>
                    </div>
                    {CONTACTS.slice(0, 6).map(contact => (
                      <div key={`quick-${contact.id}`} className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer transition-transform active:scale-95 group">
                        <div className="relative">
                          <img 
                            src={contact.avatar} 
                            alt={contact.name} 
                            className="w-14 h-14 rounded-full object-cover border border-border/50 group-hover:border-primary/50 transition-colors"
                          />
                          {contact.status === "в сети" && (
                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full"></div>
                          )}
                        </div>
                        <span className="text-[11px] font-medium w-16 text-center truncate">{contact.name.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat Results */}
              {filteredChats.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-2">
                    {searchQuery.length > 0 ? "Найденные чаты" : "Недавние чаты"}
                  </h3>
                  <div className="flex flex-col">
                    {filteredChats.map((chat) => (
                      <div 
                        key={`search-chat-${chat.id}`}
                        className="flex items-center gap-3 p-3 rounded-2xl hover:bg-secondary/50 transition-colors cursor-pointer active:scale-[0.98]"
                      >
                        <div className="relative flex-shrink-0">
                          <img 
                            src={chat.avatar} 
                            alt={chat.name} 
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <h3 className="font-semibold text-[15px] truncate pr-2">{chat.name}</h3>
                          </div>
                          <p className="text-[13px] text-muted-foreground truncate">
                            {chat.lastMessage}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact Results */}
              {filteredContacts.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-2">
                    {searchQuery.length > 0 ? "Найденные контакты" : "Все контакты"}
                  </h3>
                  <div className="flex flex-col">
                    {filteredContacts.map((contact) => (
                      <div 
                        key={`search-contact-${contact.id}`}
                        className="flex items-center justify-between p-3 rounded-2xl hover:bg-secondary/50 transition-colors cursor-pointer active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            <img 
                              src={contact.avatar} 
                              alt={contact.name} 
                              className="w-12 h-12 rounded-full object-cover"
                            />
                            {contact.status === "в сети" && (
                              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-[15px]">{contact.name}</h3>
                            <p className="text-[13px] text-muted-foreground">
                              {contact.status}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 pr-1">
                          <button className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                            <Phone className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results */}
              {filteredChats.length === 0 && filteredContacts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Search className="w-10 h-10 mb-3 opacity-20" />
                  <p>Ничего не найдено</p>
                </div>
              )}

            </div>
          ) : (
            /* REGULAR CHATS LIST */
            <div className="px-2 py-2">
              {filteredChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground p-8 text-center">
                  <MessageCircle className="w-12 h-12 mb-4 opacity-20" />
                  <p>Нет чатов, соответствующих фильтру</p>
                </div>
              ) : (
                filteredChats.map((chat) => (
                  <div 
                    key={`chat-${chat.id}`}
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
                ))
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}