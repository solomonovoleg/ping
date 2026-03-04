import { Heart, MessageSquare, Share2, MoreHorizontal, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock Data
const POSTS = [
  {
    id: 1,
    channelName: "Design & UX",
    channelAvatar: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=150&h=150&fit=crop",
    time: "2 часа назад",
    text: "Новые тренды в UI дизайне 2024 года. Glassmorphism возвращается, но в более утонченном виде с акцентом на типографику и микро-взаимодействия.",
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop",
    likes: 124,
    comments: 18,
    isLiked: false,
  },
  {
    id: 2,
    channelName: "Tech News Daily",
    channelAvatar: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=150&h=150&fit=crop",
    time: "4 часа назад",
    text: "Анонсирован новый фреймворк для создания невероятно быстрых веб-приложений. Скорость загрузки увеличена в 3 раза по сравнению с React.",
    image: null,
    likes: 890,
    comments: 142,
    isLiked: true,
  },
  {
    id: 3,
    channelName: "Nature Photography",
    channelAvatar: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=150&h=150&fit=crop",
    time: "Вчера",
    text: "Закат в горах Швейцарии. Невероятная палитра цветов.",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1000&auto=format&fit=crop",
    likes: 3450,
    comments: 56,
    isLiked: false,
  }
];

export default function Posts() {
  return (
    <div className="flex h-full w-full justify-center bg-background">
      <div className="w-full h-full flex flex-col bg-background">
        
        {/* Header */}
        <div className="px-4 py-4 glass z-10 sticky top-0">
          <h1 className="text-2xl font-bold tracking-tight">Лента</h1>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto pb-24 sm:pb-28">
          <div className="flex flex-col">
            {POSTS.map((post) => (
              <article key={post.id} className="p-4 border-b border-border/50 hover:bg-secondary/20 transition-colors">
                
                {/* Post Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 cursor-pointer">
                    <img 
                      src={post.channelAvatar} 
                      alt={post.channelName} 
                      className="w-10 h-10 rounded-xl object-cover"
                    />
                    <div>
                      <h3 className="font-semibold text-[15px]">{post.channelName}</h3>
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
                  <div className="flex items-center gap-1">
                    <button className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors text-sm font-medium",
                      post.isLiked 
                        ? "bg-red-500/10 text-red-500" 
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    )}>
                      <Heart className={cn("w-4 h-4", post.isLiked && "fill-current")} />
                      {post.likes}
                    </button>
                    
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm font-medium">
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

      </div>
    </div>
  );
}