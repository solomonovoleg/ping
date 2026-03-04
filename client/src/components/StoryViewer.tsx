import { useState, useEffect } from "react";
import { X, MoreHorizontal, Heart, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Story {
  id: string | number;
  image: string;
  userName: string;
  userAvatar: string;
  time: string;
}

interface StoryViewerProps {
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
}

export default function StoryViewer({ stories, initialIndex = 0, onClose }: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);

  // Auto-advance stories
  useEffect(() => {
    const duration = 5000; // 5 seconds per story
    const interval = 50; // update every 50ms
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < stories.length - 1) {
            setCurrentIndex((c) => c + 1);
            return 0;
          } else {
            clearInterval(timer);
            onClose();
            return 100;
          }
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [currentIndex, stories.length, onClose]);

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((c) => c + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex((c) => c - 1);
      setProgress(0);
    } else {
      setProgress(0);
    }
  };

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const width = e.currentTarget.offsetWidth;
    const x = e.nativeEvent.offsetX;
    if (x < width / 3) {
      handlePrev(e);
    } else {
      handleNext(e);
    }
  };

  if (!stories.length) return null;
  const currentStory = stories[currentIndex];

  return (
    <div className="fixed inset-0 z-[200] bg-black text-white flex flex-col animate-in fade-in zoom-in-[0.98] duration-200">
      
      {/* Progress Bars */}
      <div className="absolute top-0 inset-x-0 px-2 pt-safe-offset-2 flex gap-1 z-50">
        {stories.map((s, idx) => (
          <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-75 ease-linear"
              style={{ 
                width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? '100%' : '0%' 
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-0 inset-x-0 pt-safe-offset-6 px-4 pb-4 flex items-center justify-between z-50 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-2.5">
          <img 
            src={currentStory.userAvatar} 
            alt={currentStory.userName} 
            className="w-9 h-9 rounded-full object-cover border border-white/20"
          />
          <div className="flex items-center gap-2">
            <span className="font-medium text-[14px] shadow-sm">{currentStory.userName}</span>
            <span className="text-white/60 text-[13px]">{currentStory.time}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <MoreHorizontal className="w-6 h-6" />
          </button>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Image Content (tap areas) */}
      <div 
        className="flex-1 relative bg-zinc-900 w-full h-full flex items-center justify-center cursor-pointer"
        onClick={handleTap}
      >
        <img 
          src={currentStory.image} 
          alt="Story content" 
          className="w-full h-full object-cover sm:object-contain"
        />
      </div>

      {/* Footer Area */}
      <div className="absolute bottom-0 inset-x-0 pb-safe-offset-4 pt-8 px-4 flex items-center gap-4 bg-gradient-to-t from-black/80 to-transparent z-50">
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder="Ответить..." 
            className="w-full bg-white/10 border border-white/20 rounded-full py-3 px-5 text-white placeholder:text-white/60 outline-none focus:bg-white/20 transition-colors"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <button className="p-3 rounded-full hover:bg-white/20 transition-colors flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Heart className="w-7 h-7" />
        </button>
        <button className="p-3 rounded-full hover:bg-white/20 transition-colors flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Send className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
}
