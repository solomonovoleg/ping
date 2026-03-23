import { cn } from "@/lib/utils";

type Props = {
  text: string | null;
  className?: string;
};

/** Одна строка под индикатором слайдов; не кликабельна, только контекст. */
export function EdgeFeedSwipeHintRow({ text, className }: Props) {
  if (!text) return null;
  return (
    <p
      className={cn(
        "px-2 pb-2 pt-1 text-center text-[10px] font-light leading-relaxed tracking-wide text-muted-foreground/60",
        className,
      )}
    >
      {text}
    </p>
  );
}
