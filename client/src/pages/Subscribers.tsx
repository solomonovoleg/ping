import { useState } from "react";
import { ChevronLeft, Search, UserPlus, Check, Users } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { ListEmptyState } from "@/components/ui/empty";
import { TapScaleButton, TapScaleDiv } from "@/components/ui/tap-scale";

import avatarAlisa from "@/assets/images/avatar-alisa.png";
import avatarMom from "@/assets/images/avatar-mom.png";
import avatarDesign from "@/assets/images/avatar-design.png";
import avatarNews from "@/assets/images/avatar-news.png";

// Mock Data (publicId для ссылки на профиль: /profile/:publicId или /id/:publicId)
const SUBSCRIBERS = [
  { id: 1, publicId: 100, name: "Алиса", handle: "@alisa_wonder", avatar: avatarAlisa, isFollowing: true, isMutual: true },
  { id: 2, publicId: 101, name: "Мама", handle: "@mom_best", avatar: avatarMom, isFollowing: true, isMutual: true },
  { id: 3, publicId: 102, name: "Design & UX", handle: "@design_ux", avatar: avatarDesign, isFollowing: false, isMutual: false },
  { id: 4, publicId: 103, name: "Tech News", handle: "@tech_news", avatar: avatarNews, isFollowing: false, isMutual: false },
  { id: 5, publicId: 104, name: "Максим П.", handle: "@max_dev", avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&h=150&fit=crop", isFollowing: true, isMutual: false },
  { id: 6, publicId: 105, name: "Елена Смирнова", handle: "@helen_s", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop", isFollowing: false, isMutual: false },
  { id: 7, publicId: 106, name: "Крипто Инвестор", handle: "@crypto_king", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop", isFollowing: true, isMutual: true },
];

export default function Subscribers() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [followingState, setFollowingState] = useState<Record<number, boolean>>(
    SUBSCRIBERS.reduce((acc, user) => ({ ...acc, [user.id]: user.isFollowing }), {})
  );

  const filteredSubscribers = SUBSCRIBERS.filter(sub => 
    sub.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    sub.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleFollow = (id: number) => {
    setFollowingState(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="flex h-full w-full max-w-full min-w-0 overflow-x-hidden justify-center bg-background">
      <div className="w-full h-full max-w-[480px] min-w-0 flex flex-col bg-background relative shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="uix-content-x py-4 glass z-10 sticky top-0 relative flex items-center justify-between">
          <TapScaleButton
            type="button"
            onClick={() => window.history.back()}
            haptic
            subtle
            className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Назад"
          >
            <ChevronLeft className="w-6 h-6" />
          </TapScaleButton>
          
          <h1 className="flex-1 text-center uix-text-title">
            Подписчики
          </h1>
          
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>

        {/* Search */}
        <div className="uix-content-x py-2 border-b border-border/50">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Поиск"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-secondary text-foreground rounded-xl py-2 pl-10 pr-4 outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Subscribers List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 hide-scrollbar">
          <div className="p-2">
            {filteredSubscribers.length > 0 ? (
              filteredSubscribers.map((user) => (
                <TapScaleDiv
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-2xl hover:bg-secondary/50 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/profile/${(user as { publicId?: number }).publicId ?? user.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img 
                        src={user.avatar} 
                        alt={user.name} 
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-[15px]">{user.name}</span>
                      <span className="text-sm text-muted-foreground">{user.handle}</span>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFollow(user.id);
                    }}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-[13px] font-medium transition-all active:scale-95 flex items-center gap-1.5",
                      followingState[user.id] 
                        ? "bg-secondary text-foreground hover:bg-secondary/80" 
                        : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20"
                    )}
                    aria-label={followingState[user.id] ? `В подписках: ${user.name}` : `Подписаться на ${user.name}`}
                  >
                    {followingState[user.id] ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>В подписках</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Подписаться</span>
                      </>
                    )}
                  </button>
                </TapScaleDiv>
              ))
            ) : (
              <ListEmptyState
                icon={Users}
                title="Никого не найдено"
                description="Измените поиск или посмотрите подписчиков позже"
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
