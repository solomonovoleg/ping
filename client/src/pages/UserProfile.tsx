import { useState } from "react";
import { ChevronLeft, MoreHorizontal, Bell, Link as LinkIcon, Grid, Bookmark, MessageSquare, Share2, Copy, Check, Settings, PenSquare, Trash2, Edit3, BarChart2, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import StoryViewer from "@/components/StoryViewer";
import CommentsModal from "@/components/CommentsModal";

import avatarDesign from "@/assets/images/avatar-design.png";
import avatarMain from "@/assets/images/avatar-main.png";

export default function UserProfile({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"posts" | "saved">("posts");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState<number | null>(null);

  const isMe = params.id === "me";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://app.com/profile/${params.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Mock data for the profiles
  const profile = isMe ? {
    name: "Алексей Иванов",
    handle: "@alex_ivanov",
    avatar: avatarMain,
    cover: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop",
    bio: "Product Designer & Developer. Делюсь своими проектами, мыслями и процессами создания интерфейсов.",
    link: "t.me/alex_ivanov",
    subscribers: "842",
    postsCount: "12",
    stories: [
      { id: 1, thumb: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=150&h=150&fit=crop", title: "Рабочее" },
      { id: 2, thumb: "https://images.unsplash.com/photo-1490818387583-1baba5e638ce?w=150&h=150&fit=crop", title: "Жизнь" },
    ],
    posts: [
      {
        id: 101,
        time: "5 минут назад",
        text: "Закончил работу над новым концептом мобильного приложения. Как вам такой минималистичный подход к интерфейсу?",
        image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=1000&auto=format&fit=crop",
        reactions: [{ emoji: "🔥", count: 5 }, { emoji: "👍", count: 2 }],
        comments: 3,
      }
    ]
  } : {
    name: "Design & UX",
    handle: "@design_ux",
    avatar: avatarDesign,
    cover: "https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=1000&auto=format&fit=crop",
    bio: "Ежедневная доза вдохновения. Пишу про UI/UX, делюсь полезными ресурсами и разбираю тренды.",
    link: "t.me/design_ux",
    subscribers: "12.5K",
    postsCount: "342",
    stories: [
      { id: 1, thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&h=150&fit=crop", title: "Figma" },
      { id: 2, thumb: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=150&h=150&fit=crop", title: "Ресурсы" },
      { id: 3, thumb: "https://images.unsplash.com/photo-1558655146-d09347e92766?w=150&h=150&fit=crop", title: "Книги" },
    ],
    posts: [
      {
        id: 1,
        time: "2 часа назад",
        text: "Новые тренды в UI дизайне 2024 года. Glassmorphism возвращается, но в более утонченном виде с акцентом на типографику и микро-взаимодействия.",
        image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop",
        reactions: [{ emoji: "❤️", count: 45 }, { emoji: "🔥", count: 23 }, { emoji: "👏", count: 12 }],
        comments: 18,
      },
      {
        id: 2,
        time: "Вчера",
        text: "Подборка отличных шрифтов для интерфейсов, которые можно использовать абсолютно бесплатно. Сохраняйте, чтобы не потерять!",
        image: null,
        reactions: [{ emoji: "👍", count: 120 }, { emoji: "💯", count: 34 }],
        comments: 32,
      }
    ]
  };

  return (
    <div className="flex flex-col h-full bg-background absolute inset-0 z-[100] animate-in slide-in-from-right-full duration-300 overflow-y-auto hide-scrollbar pb-24 sm:pb-28">
      
      {/* Header - Transparent over cover */}
      <div className="absolute top-0 left-0 right-0 px-2 py-3 flex items-center justify-between pt-safe z-50 transition-all duration-300 bg-gradient-to-b from-black/50 to-transparent">
        <button 
          onClick={() => setLocation("/posts")}
          className="p-2 ml-2 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 transition-colors flex items-center"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        
        <div className="flex items-center gap-2 mr-2">
          <button 
            onClick={handleCopyLink}
            className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 transition-colors"
          >
            {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
          </button>
          
          {isMe ? (
            <button 
              onClick={() => setLocation("/settings")}
              className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          ) : (
            <>
              <button className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 transition-colors">
                <Bell className="w-5 h-5" />
              </button>
              <button className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 transition-colors">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cover Image */}
      <div className="relative h-48 sm:h-56 w-full">
        <img 
          src={profile.cover} 
          alt="Cover" 
          className="w-full h-full object-cover"
        />
        {/* Gradient overlay for smooth transition to background */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent"></div>
      </div>

      {/* Profile Info */}
      <div className="px-4 relative -mt-12 mb-6">
        <div className="flex justify-between items-end mb-3">
          <div 
            className="relative cursor-pointer group" 
            onClick={() => setActiveStoryIndex(0)}
          >
            <div className="w-24 h-24 rounded-full p-[3px] bg-gradient-to-tr from-primary to-purple-500 transition-transform duration-200 group-active:scale-95">
              <img 
                src={profile.avatar} 
                alt={profile.name} 
                className="w-full h-full rounded-full object-cover border-[3px] border-background"
              />
            </div>
            {isMe && (
              <div className="absolute bottom-1 right-1 bg-primary text-white p-1.5 rounded-full border-2 border-background">
                <Plus className="w-3 h-3" />
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            {isMe ? (
              <>
                <button className="px-4 py-2 rounded-full font-semibold text-[14px] bg-secondary text-foreground hover:bg-secondary/80 transition-all duration-300 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4" />
                  Статистика
                </button>
                <button className="px-4 py-2 rounded-full font-semibold text-[14px] bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 flex items-center gap-2">
                  <Edit3 className="w-4 h-4" />
                  Изменить
                </button>
              </>
            ) : (
              <button 
                onClick={() => setIsSubscribed(!isSubscribed)}
                className={cn(
                  "px-6 py-2 rounded-full font-semibold text-[15px] transition-all duration-300 transform active:scale-95",
                  isSubscribed 
                    ? "bg-secondary text-foreground hover:bg-secondary/80" 
                    : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                )}
              >
                {isSubscribed ? "Вы подписаны" : "Подписаться"}
              </button>
            )}
          </div>
        </div>

        <h1 className="text-2xl font-bold leading-tight">{profile.name}</h1>
        <p className="text-muted-foreground text-[15px] mb-3">{profile.handle}</p>
        
        <p className="text-[15px] leading-relaxed mb-3 text-foreground/90">
          {profile.bio}
        </p>

        <div className="flex items-center gap-2 text-primary text-[14px] font-medium mb-4">
          <LinkIcon className="w-4 h-4" />
          <a href="#" className="hover:underline">{profile.link}</a>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="font-bold text-lg">{profile.subscribers}</span>
            <span className="text-xs text-muted-foreground">Подписчиков</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg">{profile.postsCount}</span>
            <span className="text-xs text-muted-foreground">Постов</span>
          </div>
        </div>
      </div>

      {/* Profile Highlights/Stories */}
      <div className="mb-6">
        <div className="flex gap-4 overflow-x-auto hide-scrollbar px-4 pb-2">
          {isMe && (
            <div className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0 group">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-border flex items-center justify-center group-active:scale-95 transition-transform duration-200 text-muted-foreground group-hover:text-primary group-hover:border-primary/50">
                <Plus className="w-6 h-6" />
              </div>
              <span className="text-[12px] font-medium text-foreground/80">
                Новое
              </span>
            </div>
          )}
          {profile.stories.map((story, idx) => (
            <div 
              key={story.id} 
              className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0 group"
              onClick={() => setActiveStoryIndex(idx)}
            >
              <div className="w-16 h-16 rounded-full p-[2px] border border-border group-active:scale-95 transition-transform duration-200">
                <img 
                  src={story.thumb} 
                  alt={story.title} 
                  className="w-full h-full rounded-full object-cover border-2 border-background"
                />
              </div>
              <span className="text-[12px] font-medium text-foreground/80">
                {story.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/50 sticky top-0 bg-background/80 backdrop-blur-xl z-40">
        <button 
          onClick={() => setActiveTab("posts")}
          className={cn(
            "flex-1 py-3 text-[15px] font-semibold flex justify-center items-center gap-2 transition-colors relative",
            activeTab === "posts" ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
          )}
        >
          <Grid className="w-4 h-4" />
          Публикации
          {activeTab === "posts" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"></div>
          )}
        </button>
        <button 
          onClick={() => setActiveTab("saved")}
          className={cn(
            "flex-1 py-3 text-[15px] font-semibold flex justify-center items-center gap-2 transition-colors relative",
            activeTab === "saved" ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
          )}
        >
          <Bookmark className="w-4 h-4" />
          Сохраненное
          {activeTab === "saved" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"></div>
          )}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex flex-col">
        {activeTab === "posts" && isMe && (
          <div className="p-4 border-b border-border/50 bg-secondary/10 flex items-center gap-3 cursor-pointer hover:bg-secondary/20 transition-colors" onClick={() => setLocation("/create-post")}>
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-primary flex-shrink-0">
              <PenSquare className="w-5 h-5" />
            </div>
            <div className="text-[15px] text-muted-foreground font-medium">
              Написать новый пост...
            </div>
          </div>
        )}

        {activeTab === "posts" ? (
          profile.posts.map((post) => (
            <article key={post.id} className="p-4 border-b border-border/50 hover:bg-secondary/20 transition-colors relative group/article">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <img 
                    src={profile.avatar} 
                    alt={profile.name} 
                    className="w-10 h-10 rounded-xl object-cover"
                  />
                  <div>
                    <h3 className="font-semibold text-[15px]">{profile.name}</h3>
                    <p className="text-xs text-muted-foreground">{post.time}</p>
                  </div>
                </div>
                
                {isMe ? (
                  <div className="flex items-center gap-1 opacity-0 group-hover/article:opacity-100 transition-opacity">
                    <button className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-secondary">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                )}
              </div>

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

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  {/* Reactions Pill instead of Like button */}
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer border border-border/30">
                    {post.reactions?.map((reaction: {emoji: string, count: number}, i: number) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className="text-base leading-none">{reaction.emoji}</span>
                        {i === post.reactions.length - 1 && (
                          <span className="text-sm font-medium ml-1">
                            {post.reactions.reduce((sum: number, r: {count: number}) => sum + r.count, 0)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <button 
                    onClick={() => setActiveCommentPostId(post.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm font-medium"
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
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <Bookmark className="w-12 h-12 mb-4 opacity-20" />
            <p>Здесь пока ничего нет</p>
          </div>
        )}
      </div>

      {activeStoryIndex !== null && (
        <StoryViewer 
          stories={profile.stories.map(s => ({
            id: s.id,
            image: s.thumb,
            userName: profile.name,
            userAvatar: profile.avatar,
            time: "2ч"
          }))} 
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
  );
}
