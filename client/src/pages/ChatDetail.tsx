import { useState, useRef, useEffect } from "react";
import { ChevronLeft, Phone, Video, MoreVertical, Send, Paperclip, Mic, Smile, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

// Import all avatars needed for mock data
import avatarAi from "@/assets/images/avatar-ai.png";
import avatarAlisa from "@/assets/images/avatar-alisa.png";
import avatarDesign from "@/assets/images/avatar-design.png";
import avatarProduct from "@/assets/images/avatar-product.png";
import avatarMom from "@/assets/images/avatar-mom.png";
import avatarNews from "@/assets/images/avatar-news.png";
import avatarIvan from "@/assets/images/avatar-ivan.png";

// Mock data to match Chats.tsx
const CHAT_DETAILS = {
  "0": { name: "AI CHAT", avatar: avatarAi, isAI: true, online: true, status: "бот" },
  "1": { name: "Алиса Смирнова", avatar: avatarAlisa, online: true, status: "в сети" },
  "2": { name: "Команда Дизайна", avatar: avatarDesign, online: false, status: "12 участников" },
  "3": { name: "Продакты", avatar: avatarProduct, online: false, status: "8 участников" },
  "4": { name: "Мама", avatar: avatarMom, online: true, status: "в сети" },
  "5": { name: "Новости IT", avatar: avatarNews, online: false, status: "145к подписчиков" },
  "6": { name: "Иван Разработчик", avatar: avatarIvan, online: false, status: "был(а) недавно" },
};

export default function ChatDetail({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const chatId = params.id;
  const chatInfo = CHAT_DETAILS[chatId as keyof typeof CHAT_DETAILS] || CHAT_DETAILS["1"];
  
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Mock messages based on chat type
  const [messages, setMessages] = useState(() => {
    if (chatId === "2") {
      // Group chat messages
      return [
        {
          id: 0,
          type: "system",
          text: "Алексей создал(а) группу «Команда Дизайна»",
          time: "10:00"
        },
        { 
          id: 1, 
          text: "Ребят, как продвигается работа над новым онбордингом?", 
          time: "11:30", 
          isMe: false, 
          sender: "Иван Разработчик",
          avatar: avatarIvan,
          reactions: []
        },
        { 
          id: 2, 
          text: "Я уже скинул новые макеты, можете посмотреть", 
          time: "11:45", 
          isMe: true,
          sender: "Вы",
          reactions: ["🔥"]
        },
        { 
          id: 3, 
          text: "Выглядит супер! Давайте обсудим детали на созвоне в 16:00", 
          time: "11:50", 
          isMe: false,
          sender: "Алиса Смирнова",
          avatar: avatarAlisa,
          reactions: ["👍", "❤️"]
        }
      ];
    }
    
    // Default 1-on-1 / AI messages
    return [
      { 
        id: 1, 
        text: "Привет! Как дела?", 
        time: "14:20", 
        isMe: false, 
        sender: chatInfo?.name || "Алиса Смирнова",
        avatar: chatInfo?.avatar || avatarAlisa,
        reactions: ["👍"]
      },
      { 
        id: 2, 
        text: "Всё отлично, работаю над новым дизайном 🚀", 
        time: "14:22", 
        isMe: true,
        sender: "Вы",
        reactions: ["🔥", "❤️"]
      },
      { 
        id: 3, 
        text: chatInfo?.isAI ? "Чем могу помочь сегодня?" : "Давай встретимся в 19:00 у входа?", 
        time: "14:23", 
        isMe: false,
        sender: chatInfo?.name || "Алиса Смирнова",
        avatar: chatInfo?.avatar || avatarAlisa,
        reactions: []
      }
    ];
  });

  const handleSend = () => {
    if (!message.trim()) return;
    
    setMessages([...messages, {
      id: Date.now(),
      text: message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
      sender: "Вы",
      reactions: []
    }]);
    
    setMessage("");
    
    // Auto reply if AI
    if (chatInfo.isAI) {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: "Я обрабатываю ваш запрос. Подождите секунду...",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMe: false,
          sender: chatInfo.name,
          avatar: chatInfo.avatar,
          reactions: []
        }]);
      }, 1000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-background absolute inset-0 z-[100] animate-in slide-in-from-right-full duration-300">
      {/* Header */}
      <div className="glass px-2 py-3 flex items-center justify-between border-b border-border/50 pt-safe z-10">
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setLocation("/")}
            className="p-2 -ml-2 rounded-full text-primary hover:bg-primary/10 transition-colors flex items-center"
          >
            <ChevronLeft className="w-6 h-6" />
            <span className="text-[17px]">Назад</span>
          </button>
          
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <img 
                src={chatInfo.avatar} 
                alt={chatInfo.name} 
                className={cn(
                  "w-10 h-10 object-cover",
                  chatInfo.isAI ? "rounded-xl" : "rounded-full"
                )}
              />
              {chatInfo.online && !chatInfo.isAI && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full"></div>
              )}
            </div>
            <div className="flex flex-col">
              <span className={cn(
                "font-semibold text-[16px] leading-tight",
                chatInfo.isAI && "text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500"
              )}>
                {chatInfo.name}
              </span>
              <span className={cn(
                "text-[13px] leading-none",
                chatInfo.isAI || chatInfo.online ? "text-primary/80" : "text-muted-foreground"
              )}>
                {chatInfo.status}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!chatInfo.isAI && (
            <>
              <button className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors">
                <Phone className="w-5 h-5" />
              </button>
              <button className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors">
                <Video className="w-5 h-5" />
              </button>
            </>
          )}
          <button className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-secondary/20 hide-scrollbar pb-20">
        <div className="text-center text-xs text-muted-foreground my-2">Сегодня</div>
        
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.type === "system" ? (
              <div className="flex justify-center my-4">
                <span className="bg-secondary/50 text-muted-foreground text-[11px] px-3 py-1 rounded-full text-center">
                  {msg.text}
                </span>
              </div>
            ) : (
              <div 
                className={cn(
                  "flex max-w-[85%] gap-2",
                  msg.isMe ? "self-end flex-row-reverse" : "self-start flex-row"
                )}
              >
                {/* Avatar for others */}
                {!msg.isMe && (
                  <img 
                    src={msg.avatar} 
                    alt={msg.sender} 
                    className={cn(
                      "w-8 h-8 object-cover flex-shrink-0 mt-auto",
                      chatInfo.isAI ? "rounded-lg" : "rounded-full"
                    )}
                  />
                )}

                <div className="flex flex-col gap-1 w-full">
                  {/* Sender name for groups/others */}
                  {!msg.isMe && !chatInfo.isAI && (
                    <span className="text-[12px] font-medium text-muted-foreground ml-1">
                      {msg.sender}
                    </span>
                  )}
                  
                  <div className="relative">
                    <div className={cn(
                      "px-4 py-2.5 rounded-2xl relative group",
                      msg.isMe 
                        ? "bg-primary text-primary-foreground rounded-br-sm" 
                        : chatInfo.isAI 
                          ? "bg-primary/10 text-foreground rounded-bl-sm border border-primary/20"
                          : "bg-card border shadow-sm text-foreground rounded-bl-sm"
                    )}>
                      <p className="text-[15px] leading-relaxed break-words">{msg.text}</p>
                      
                      {/* Reactions */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className={cn(
                          "absolute -bottom-3 flex gap-1 bg-background/90 backdrop-blur-md border shadow-sm rounded-full px-1.5 py-0.5 text-[12px]",
                          msg.isMe ? "right-2" : "left-2"
                        )}>
                          {msg.reactions.map((r, i) => (
                            <span key={i} className="cursor-pointer hover:scale-125 transition-transform">{r}</span>
                          ))}
                        </div>
                      )}

                      <div className={cn(
                        "text-[10px] mt-1 flex justify-end items-center gap-1 opacity-70",
                        msg.isMe ? "text-primary-foreground" : "text-muted-foreground"
                      )}>
                        {msg.time}
                        {msg.isMe && (
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="glass px-3 py-3 border-t border-border/50 pb-safe">
        <div className="flex items-end gap-2">
          <button className="p-2 flex-shrink-0 text-muted-foreground hover:text-primary transition-colors">
            <Paperclip className="w-6 h-6" />
          </button>
          
          <div className="flex-1 bg-secondary rounded-2xl border border-border/50 flex items-end">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Сообщение..."
              className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[40px] py-2.5 px-3 text-[15px] outline-none"
              rows={1}
            />
            <button className="p-2.5 flex-shrink-0 text-muted-foreground hover:text-primary transition-colors">
              <Smile className="w-5 h-5" />
            </button>
          </div>
          
          {message.trim() ? (
            <button 
              onClick={handleSend}
              className="p-3 flex-shrink-0 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity flex items-center justify-center h-10 w-10"
            >
              <Send className="w-5 h-5 translate-x-[-1px] translate-y-[1px]" />
            </button>
          ) : (
            <button className="p-3 flex-shrink-0 bg-secondary text-foreground rounded-full hover:bg-secondary/80 transition-colors flex items-center justify-center h-10 w-10">
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
