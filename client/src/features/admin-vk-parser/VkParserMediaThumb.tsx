import { useState } from "react";
import { ImageOff } from "lucide-react";

export function VkParserMediaThumb(props: { src: string; index: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="w-20 h-20 shrink-0 rounded-md border border-border/60 bg-muted flex items-center justify-center text-muted-foreground"
        role="img"
        aria-label={`Миниатюра ${props.index + 1} недоступна`}
      >
        <ImageOff className="w-6 h-6 opacity-60" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={props.src}
      alt=""
      loading="lazy"
      decoding="async"
      className="w-20 h-20 object-cover rounded-md border border-border/60 bg-muted"
      onError={() => setFailed(true)}
    />
  );
}
