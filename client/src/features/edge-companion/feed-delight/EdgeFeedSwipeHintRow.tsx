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
        "mx-2 mb-2 mt-0.5 rounded-lg bg-primary/10 px-2 py-1.5 text-center text-[10px] font-medium leading-relaxed tracking-wide text-primary/90 dark:bg-primary/15 dark:text-primary",
        className,
      )}
    >
      {text}
    </p>
  );
}
