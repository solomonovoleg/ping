import { useState } from "react";
import { Heart, MessageSquare, Share2, MoreHorizontal, Bookmark, Plus, PenSquare, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import StoryViewer from "@/components/StoryViewer";
import CommentsModal from "@/components/CommentsModal";

import avatarMain from "@/assets/images/avatar-main.png";
import avatarAlisa from "@/assets/images/avatar-alisa.png";
import avatarDesign from "@/assets/images/avatar-design.png";
import avatarMom from "@/assets/images/avatar-mom.png";
import avatarNews from "@/assets/images/avatar-news.png";

// Mock Data
const STORIES = [
  { id: 'me', name: 'Моя история', avatar: avatarMain, isMe: true, hasUnseen: false, image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&h=1200&fit=crop", time: "5м", views: 128 },
  { id: 1, name: 'Алиса', avatar: avatarAlisa, isMe: false, hasUnseen: true, image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=1200&fit=crop", time: "1ч", isTrending: true },
  { id: 2, name: 'Мама', avatar: avatarMom, isMe: false, hasUnseen: true, image: "https://images.unsplash.com/photo-1490818387583-1baba5e638ce?w=800&h=1200&fit=crop", time: "3ч" },
  { id: 3, name: 'Design', avatar: avatarDesign, isMe: false, hasUnseen: true, image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=1200&fit=crop", time: "5ч" },
  { id: 4, name: 'Новости', avatar: avatarNews, isMe: false, hasUnseen: false, image: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&h=1200&fit=crop", time: "8ч", isTrending: true },
];

const POSTS = [
  {
    id: 1,
    creatorId: "design_ux",
    channelName: "Design & UX",
    channelAvatar: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=150&h=150&fit=crop",
    time: "2 часа назад",
    text: "Новые тренды в UI дизайне 2024 года. Glassmorphism возвращается, но в более утонченном виде с акцентом на типографику и микро-взаимодействия.",
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop",
    reactions: [{ emoji: "❤️", count: 45 }, { emoji: "🔥", count: 23 }, { emoji: "👏", count: 12 }],
    comments: 18,
  },
  {
    id: 2,
    creatorId: "tech_news",
    channelName: "Tech News Daily",
    channelAvatar: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=150&h=150&fit=crop",
    time: "4 часа назад",
    text: "Анонсирован новый фреймворк для создания невероятно быстрых веб-приложений. Скорость загрузки увеличена в 3 раза по сравнению с React.",
    image: null,
    reactions: [{ emoji: "👍", count: 120 }, { emoji: "💯", count: 34 }],
    comments: 142,
  },
  {
    id: 3,
    creatorId: "nature",
    channelName: "Nature Photography",
    channelAvatar: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=150&h=150&fit=crop",
    time: "Вчера",
    text: "Закат в горах Швейцарии. Невероятная палитра цветов.",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1000&auto=format&fit=crop",
    reactions: [{ emoji: "❤️", count: 850 }, { emoji: "😍", count: 120 }],
    comments: 56,
  }
];

export default function Posts() {
  const [, setLocation] = useLocation();
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState<number | null>(null);
  const [userReactions, setUserReactions] = useState<Record<number, string>>({});
  const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null);
  
  const EMOJIS = ['👍', '❤️', '🔥', '👏', '😂', '🤔'];
  
  const storiesForViewer = STORIES.map(s => ({
    id: s.id,
    image: s.image,
    userName: s.name,
    userAvatar: s.avatar,
    time: s.time
  }));

  return (
    <div className="flex h-full w-full justify-center bg-background">
      <div className="w-full h-full flex flex-col bg-background">
        
        {/* Header */}
        <div className="px-4 py-4 glass z-10 sticky top-0 relative flex items-center justify-between">
          <div className="w-1/3">
            <h1 className="text-2xl font-bold tracking-tight">Лента</h1>
          </div>
          
          <div className="w-1/3 flex justify-center">
            <button 
              onClick={() => setLocation("/profile/me")}
              className="font-semibold text-[17px] hover:text-primary transition-colors px-3 py-1 rounded-full hover:bg-primary/5 active:bg-primary/10 whitespace-nowrap"
            >
              Алексей Иванов
            </button>
          </div>
          
          <div className="w-1/3 flex justify-end">
            <button 
              onClick={() => setLocation("/create-post")}
              className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <PenSquare className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feed Content */}
        <div className="flex-1 overflow-y-auto pb-24 sm:pb-28">
          
          {/* Stories Section */}
          <div className="py-4 border-b border-border/50 bg-background/50">
            <div className="flex gap-4 overflow-x-auto hide-scrollbar px-4">
              {STORIES.map((story, idx) => (
                <div 
                  key={story.id} 
                  className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0 group"
                  onClick={() => setActiveStoryIndex(idx)}
                >
                  <div className="relative">
                    <div className={cn(
                      "w-16 h-16 rounded-full p-[2px] transition-transform duration-200 group-active:scale-95",
                      story.hasUnseen 
                        ? "bg-gradient-to-tr from-primary to-purple-500" 
                        : "bg-border"
                    )}>
                      <img 
                        src={story.avatar} 
                        alt={story.name} 
                        className="w-full h-full rounded-full object-cover border-2 border-background"
                      />
                    </div>
                    {story.isMe && (
                      <div className="absolute bottom-0 right-0 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center border-2 border-background z-10">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {story.isTrending && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-sm border-[1.5px] border-background px-1.5 py-0.5 rounded-md flex items-center gap-0.5 z-10 animate-[pulse_2s_ease-in-out_infinite]">
                        <span className="text-[9px] font-bold tracking-wide uppercase leading-none">HOT</span>
                      </div>
                    )}
                    {story.views !== undefined && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground shadow-sm border border-background px-1.5 py-0.5 rounded-full flex items-center gap-1 z-10">
                        <Eye className="w-3 h-3 opacity-70" />
                        <span className="text-[10px] font-semibold leading-none">{story.views}</span>
                      </div>
                    )}
                  </div>
                  <span className={cn(
                    "text-[11px] font-medium text-foreground/80 max-w-[64px] truncate text-center",
                    (story.isTrending || story.views !== undefined) ? "mt-1.5" : ""
                  )}>
                    {story.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Posts List */}
          <div className="flex flex-col">
            {POSTS.map((post) => (
              <article key={post.id} className="p-4 border-b border-border/50 hover:bg-secondary/20 transition-colors">
                
                {/* Post Header */}
                <div className="flex items-center justify-between mb-3">
                  <div 
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => setLocation(post.creatorId === "me" ? "/profile/me" : `/profile/${post.creatorId}`)}
                  >
                    <img 
                      src={post.channelAvatar} 
                      alt={post.channelName} 
                      className="w-10 h-10 rounded-xl object-cover group-hover:opacity-80 transition-opacity"
                    />
                    <div>
                      <h3 className="font-semibold text-[15px] group-hover:text-primary transition-colors">{post.channelName}</h3>
                      <p className="text-xs text-muted-foreground">{post.time}</p>
                    </div>
                  </div>
                  <button className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-secondary">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>

                {/* Post Content */}
                <div className="mb-3">
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                    {post.text}
                  </p>
                  
                  {post.image && (
                    <div className="mt-3 rounded-2xl overflow-hidden border border-border/50">
                      <img 
                        src={post.image} 
                        alt="Post attachment" 
                        className="w-full h-auto max-h-[400px] object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* Post Actions */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 relative">
                    {/* Reactions Pill */}
                    <div 
                      className={cn(
                        "flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary transition-colors cursor-pointer border active:scale-95 select-none",
                        userReactions[post.id]
                          ? "bg-primary/10 border-primary/30 text-foreground" 
                          : "text-secondary-foreground hover:bg-secondary/80 border-border/30"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (userReactions[post.id]) {
                          // Remove reaction if already reacted
                          const newReactions = {...userReactions};
                          delete newReactions[post.id];
                          setUserReactions(newReactions);
                        } else {
                          // Show picker if no reaction yet
                          setShowReactionPicker(showReactionPicker === post.id ? null : post.id);
                        }
                      }}
                    >
                      {/* Show existing reactions */}
                      {post.reactions?.map((reaction: {emoji: string, count: number}, i: number) => {
                        // If this is the emoji the user reacted with, don't show it here (it will be shown as the user's reaction)
                        if (userReactions[post.id] === reaction.emoji) return null;
                        
                        return (
                          <div key={i} className="flex items-center gap-1 pointer-events-none">
                            <span className="text-base leading-none">{reaction.emoji}</span>
                          </div>
                        );
                      })}
                      
                      {/* Show user's reaction if they have one */}
                      {userReactions[post.id] && (
                        <div className="flex items-center gap-1 pointer-events-none">
                          <span className="text-base leading-none">{userReactions[post.id]}</span>
                        </div>
                      )}
                      
                      {/* Total count */}
                      <span className="text-sm font-medium ml-1 pointer-events-none">
                        {post.reactions.reduce((sum: number, r: {count: number, emoji: string}) => {
                          // Don't double count if user reacted with an existing emoji
                          if (userReactions[post.id] === r.emoji) return sum + r.count;
                          return sum + r.count;
                        }, 0) + (userReactions[post.id] && !post.reactions.find(r => r.emoji === userReactions[post.id]) ? 1 : 0)}
                      </span>
                    </div>
                    
                    {/* Add Reaction Button */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowReactionPicker(showReactionPicker === post.id ? null : post.id);
                      }}
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full bg-secondary transition-colors border",
                        showReactionPicker === post.id 
                          ? "text-primary border-primary/50 bg-primary/10" 
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/80 border-border/30"
                      )}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    
                    {/* Reaction Picker Popup */}
                    {showReactionPicker === post.id && (
                      <div className="absolute bottom-full left-0 mb-2 bg-background/95 backdrop-blur-xl border border-border shadow-lg rounded-full px-3 py-2 flex items-center gap-2 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
                        {EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={(e) => {
                              e.stopPropagation();
                              setUserReactions(prev => ({
                                ...prev,
                                [post.id]: emoji
                              }));
                              setShowReactionPicker(null);
                            }}
                            className="text-2xl hover:scale-125 transition-transform active:scale-95"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    <button 
                      onClick={() => setActiveCommentPostId(post.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm font-medium border border-border/30 ml-auto"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {post.comments}
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                      <Bookmark className="w-5 h-5" />
                    </button>
                    <button className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

              </article>
            ))}
          </div>
        </div>

        {activeStoryIndex !== null && (
          <StoryViewer 
            stories={storiesForViewer} 
            initialIndex={activeStoryIndex} 
            onClose={() => setActiveStoryIndex(null)} 
          />
        )}

        <CommentsModal 
          isOpen={activeCommentPostId !== null} 
          onClose={() => setActiveCommentPostId(null)} 
          postId={activeCommentPostId} 
        />
      </div>
    </div>
  );
}