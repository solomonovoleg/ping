import { useState } from "react";
import { X, Send, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

import avatarMain from "@/assets/images/avatar-main.png";
import avatarDesign from "@/assets/images/avatar-design.png";

interface Comment {
  id: number;
  user: string;
  avatar: string;
  text: string;
  time: string;
  likes: number;
  isLiked?: boolean;
}

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: number | null;
}

// Mock comments data
const MOCK_COMMENTS: Comment[] = [
  { id: 1, user: "Design & UX", avatar: avatarDesign, text: "Очень круто! Тоже замечаю этот тренд.", time: "1 ч", likes: 5, isLiked: true },
  { id: 2, user: "Иван Иванов", avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&h=150&fit=crop", text: "А мне старый глассморфизм больше нравился, если честно.", time: "30 м", likes: 2 },
  { id: 3, user: "Анна Смирнова", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop", text: "Согласна, типографика решает всё 👏", time: "15 м", likes: 0 },
];

export default function CommentsModal({ isOpen, onClose, postId }: CommentsModalProps) {
  const [comments, setComments] = useState<Comment[]>(MOCK_COMMENTS);
  const [newComment, setNewComment] = useState("");

  if (!isOpen) return null;

  const handleSend = () => {
    if (!newComment.trim()) return;
    
    const comment: Comment = {
      id: Date.now(),
      user: "Александр Дизайнов",
      avatar: avatarMain,
      text: newComment,
      time: "Только что",
      likes: 0
    };
    
    setComments([...comments, comment]);
    setNewComment("");
  };

  const toggleLike = (id: number) => {
    setComments(comments.map(c => 
      c.id === id ? { ...c, isLiked: !c.isLiked, likes: c.isLiked ? c.likes - 1 : c.likes + 1 } : c
    ));
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 w-full bg-black/40 z-[200] backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal / Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 w-full max-w-[480px] mx-auto z-[201] bg-background rounded-t-3xl flex flex-col h-[75vh] shadow-2xl animate-in slide-in-from-bottom-full duration-300">
        
        {/* Drag handle (Mobile) */}
        <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 border-b border-border/50 flex justify-between items-center shrink-0">
          <h2 className="font-bold text-lg">Комментарии <span className="text-muted-foreground font-normal text-sm ml-1">{comments.length}</span></h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <img 
                src={comment.avatar} 
                alt={comment.user} 
                className="w-9 h-9 rounded-full object-cover shrink-0"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-[14px]">{comment.user}</span>
                  <span className="text-muted-foreground text-xs">{comment.time}</span>
                </div>
                <p className="text-[14px] leading-relaxed mb-1">{comment.text}</p>
                <button className="text-muted-foreground text-xs font-medium hover:text-foreground">
                  Ответить
                </button>
              </div>
              <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                <button 
                  onClick={() => toggleLike(comment.id)}
                  className="p-1.5 rounded-full hover:bg-secondary transition-colors"
                >
                  <Heart className={cn(
                    "w-4 h-4 transition-colors", 
                    comment.isLiked ? "fill-red-500 text-red-500" : "text-muted-foreground"
                  )} />
                </button>
                {comment.likes > 0 && (
                  <span className="text-xs text-muted-foreground">{comment.likes}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-border/50 pb-safe bg-background/80 backdrop-blur-xl shrink-0">
          <div className="flex items-end gap-3 bg-secondary/50 rounded-3xl p-1.5 pl-4 border border-border/50">
            <input 
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Оставить комментарий..."
              className="flex-1 bg-transparent border-none outline-none py-2.5 text-[15px] placeholder:text-muted-foreground"
            />
            <button 
              onClick={handleSend}
              disabled={!newComment.trim()}
              className="p-2.5 rounded-full bg-primary text-primary-foreground shrink-0 disabled:opacity-50 disabled:bg-secondary disabled:text-muted-foreground transition-all"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </div>
        </div>

      </div>
    </>
  );
}
