/** Sticky-разделитель даты в ленте сообщений (как в Telegram). */
export function ChatDetailMessageDatePill({ label }: { label: string }) {
  return (
    <p className="sticky top-2 z-[1] mx-auto rounded-full bg-muted/70 px-3 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-sm">
      {label}
    </p>
  );
}
