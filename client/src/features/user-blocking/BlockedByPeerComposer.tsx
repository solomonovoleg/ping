import { ShieldOff } from "lucide-react";

type Props = {
  note?: string | null;
  className?: string;
};

/** Замена композера DM, когда собеседник ограничил переписку. */
export function BlockedByPeerComposer({ note, className }: Props) {
  const trimmed = typeof note === "string" ? note.trim() : "";
  return (
    <div
      className={
        className ??
        "border-t border-border/60 bg-muted/25 px-4 py-4 text-center text-sm text-muted-foreground"
      }
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-1">
        <ShieldOff className="h-5 w-5 text-muted-foreground/80" aria-hidden />
        <p className="font-medium text-foreground">Вы заблокированы в переписке</p>
        <p className="text-xs leading-snug">Собеседник ограничил для вас сообщения и звонки.</p>
        {trimmed ? (
          <p className="mt-1 rounded-lg bg-background/80 px-3 py-2 text-xs text-foreground/90">&ldquo;{trimmed}&rdquo;</p>
        ) : null}
      </div>
    </div>
  );
}
