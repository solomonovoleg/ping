import { useState } from "react";
import { Search, Edit, Check, CheckCheck, MessageCircle, Phone, Video, X, UserPlus, ChevronLeft, PenSquare } from "lucide-react";
import { cn } from "@/lib/utils";

import avatarAi from "@/assets/images/avatar-ai.png";
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
    id: 0,
    name: "AI Assistant",
    avatar: avatarAi,
    lastMessage: "Привет! Чем могу помочь сегодня?",
    time: "Сейчас",
    unread: 0,
    online: true,
    folder: "all",
    typing: false,
    isAI: true,
  },
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
  const [showContactsPage, setShowContactsPage] = useState(false);
  const [contactsSearchQuery, setContactsSearchQuery] = useState("");

  const searchLower = searchQuery.toLowerCase();
  
  const filteredChats = CHATS.filter(chat => {
    if (searchQuery.length > 0) {
      return chat.name.toLowerCase().includes(searchLower) || chat.lastMessage.toLowerCase().includes(searchLower);
    }
    return activeFolder === "all" || 
          (activeFolder === "unread" && chat.unread > 0) ||
          chat.folder === activeFolder;
  });

  const contactsSearchLower = contactsSearchQuery.toLowerCase();
  const filteredContacts = CONTACTS.filter(contact => 
    contact.name.toLowerCase().includes(contactsSearchLower)
  );

  const groupedContacts = filteredContacts.reduce((acc, contact) => {
    if (!acc[contact.letter]) {
      acc[contact.letter] = [];
    }
    acc[contact.letter].push(contact);
    return acc;
  }, {} as Record<string, typeof CONTACTS>);

  // Экран контактов
  if (showContactsPage) {
    return (
      <div className="flex h-full w-full bg-background animate-in slide-in-from-right-4 duration-300">
        <div className="w-full flex flex-col h-full relative">
          {/* Contacts Header */}
          <div className="px-4 pt-6 pb-2 glass z-20 sticky top-0 border-b border-border/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setShowContactsPage(false);
                    setContactsSearchQuery("");
                  }}
                  className="p-2 -ml-2 rounded-full text-primary hover:bg-primary/10 transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-bold tracking-tight">Контакты</h1>
              </div>
              <button className="text-primary font-medium px-2">Изм.</button>
            </div>

            <div className="relative mb-2">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Поиск контактов..." 
                value={contactsSearchQuery}
                onChange={(e) => setContactsSearchQuery(e.target.value)}
                className="w-full bg-secondary/50 border-none rounded-xl py-2.5 pl-10 pr-10 text-[15px] focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/70 outline-none"
              />
              {contactsSearchQuery && (
                <button 
                  onClick={() => setContactsSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted-foreground/20 flex items-center justify-center text-muted-foreground hover:bg-muted-foreground/30 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Contacts List */}
          <div className="flex-1 overflow-y-auto pb-24 sm:pb-28 px-2">
            {!contactsSearchQuery && (
              <div className="flex items-center gap-3 p-3 ml-1 mb-2 hover:bg-secondary/50 rounded-2xl cursor-pointer text-primary font-medium transition-colors">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                Добавить контакт
              </div>
            )}

            {Object.keys(groupedContacts).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <p>Ничего не найдено</p>
              </div>
            ) : (
              Object.keys(groupedContacts).sort().map(letter => (
                <div key={letter} className="mb-2">
                  {!contactsSearchQuery && (
                    <div className="px-4 py-1 text-sm font-bold text-muted-foreground bg-background sticky top-[120px] z-10">
                      {letter}
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    {groupedContacts[letter].map(contact => (
                      <div 
                        key={`contact-${contact.id}`}
                        className="flex items-center justify-between p-3 hover:bg-secondary/50 rounded-2xl cursor-pointer transition-colors group active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
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
                            <h3 className="font-semibold text-[16px]">{contact.name}</h3>
                            <p className={`text-sm ${contact.status === 'в сети' ? 'text-primary' : 'text-muted-foreground'}`}>
                              {contact.status}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pr-1">
                          <button className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                            <Phone className="w-4 h-4" />
                          </button>
                          <button className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                            <Video className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Экран чатов
  return (
    <div className="flex h-full w-full animate-in fade-in duration-300">
      <div className="w-full flex flex-col h-full bg-background relative">
        
        {/* Header */}
        <div className="px-4 pt-6 pb-2 glass z-20 sticky top-0 border-b border-border/50">
          
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold tracking-tight">Чаты</h1>
            <button className="p-2 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
              <Edit className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar with Contact Icon inside/next to it */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 group">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Поиск по чатам..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
            
            <button 
              onClick={() => setShowContactsPage(true)}
              className="p-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex-shrink-0"
              title="Контакты"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          </div>

          {/* Folders (Scrollable) */}
          {!searchQuery && (
            <div className="flex overflow-x-auto hide-scrollbar pt-1 -mx-4 px-4 gap-2">
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
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-2xl transition-colors cursor-pointer active:scale-[0.98]",
                    chat.isAI ? "bg-primary/5 hover:bg-primary/10 border border-primary/20 shadow-sm" : "hover:bg-secondary/50"
                  )}
                >
                  <div className="relative flex-shrink-0">
                    <img 
                      src={chat.avatar} 
                      alt={chat.name} 
                      className={cn(
                        "w-14 h-14 object-cover",
                        chat.isAI ? "rounded-2xl shadow-inner" : "rounded-full"
                      )}
                    />
                    {chat.online && !chat.isAI && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className={cn("font-semibold text-[16px] truncate pr-2", chat.isAI && "text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500")}>
                        {chat.name}
                      </h3>
                      <span className={cn("text-xs flex-shrink-0", chat.isAI ? "text-primary/70 font-medium" : "text-muted-foreground")}>{chat.time}</span>
                    </div>
                    
                    <div className="flex justify-between items-center gap-2">
                      <p className={cn(
                        "text-[14px] truncate",
                        chat.typing ? "text-primary" : chat.isAI ? "text-foreground/80 font-medium" : "text-muted-foreground"
                      )}>
                        {chat.typing ? "Печатает..." : chat.lastMessage}
                      </p>
                      
                      {chat.unread > 0 ? (
                        <div className="flex-shrink-0 min-w-[20px] h-[20px] px-1.5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[11px] font-bold">
                          {chat.unread}
                        </div>
                      ) : chat.read ? (
                        <CheckCheck className="w-4 h-4 text-primary flex-shrink-0" />
                      ) : !chat.isAI ? (
                        <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}