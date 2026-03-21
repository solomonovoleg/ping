import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { resolveUrl } from "@/lib/api-base";
import { usePulseProfileTheme } from "@/features/profile/pulse-profile";

/** Превью папки: фото или короткое зацикленное видео (play только в зоне видимости). */
export function PinCoverThumb({
  url,
  isVideo,
  label,
  empty,
}: {
  url: string | null;
  isVideo: boolean;
  label: string;
  empty?: boolean;
}) {
  const { th, isDark } = usePulseProfileTheme();
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isVideo || !url) return;
    const root = wrapRef.current;
    const vid = videoRef.current;
    if (!root || !vid) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) void vid.play().catch(() => {});
        else {
          vid.pause();
          try {
            vid.currentTime = 0;
          } catch {
            /* ignore */
          }
        }
      },
      { threshold: 0.25, rootMargin: "40px" }
    );
    io.observe(root);
    return () => io.disconnect();
  }, [isVideo, url]);

  if (empty || !url) {
    return (
      <div
        className="relative flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-2xl"
        style={{
          background: isDark ? "rgba(255,255,255,0.07)" : "#ffffff",
          border: `1.5px solid ${th.border}`,
        }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ background: `${th.accent}20`, border: `1.5px dashed ${th.accent}60` }}
        >
          <Plus style={{ width: 15, height: 15, color: th.accent }} />
        </div>
      </div>
    );
  }

  const src = resolveUrl(url);
  if (isVideo) {
    return (
      <div ref={wrapRef} className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-2xl bg-black/40">
        <video
          ref={videoRef}
          src={src}
          className="h-full w-full object-cover"
          muted
          playsInline
          loop
          preload="metadata"
          aria-label={label}
        />
      </div>
    );
  }

  return (
    <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-2xl bg-black/20">
      <img src={src} alt="" className="h-full w-full object-cover" />
    </div>
  );
}
