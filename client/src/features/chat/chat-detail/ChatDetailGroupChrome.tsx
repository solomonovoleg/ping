import { cn } from "@/lib/utils";
import { TapScaleButton } from "@/components/ui/tap-scale";
import type { GroupCallMedia } from "@/lib/group-calls-api";

export type ChatDetailGroupFolderTab = {
  id: string;
  name: string;
  isMain: boolean;
  unreadCount?: number;
};

/** Горизонтальная полоса папок в групповом чате. */
export function ChatDetailGroupFolderStrip({
  folders,
  currentFolderId,
  onFolderSelect,
}: {
  folders: ChatDetailGroupFolderTab[];
  currentFolderId: string | null;
  onFolderSelect: (folderId: string) => void;
}) {
  if (folders.length === 0) return null;

  return (
    <div className="shrink-0 uix-content-x overflow-x-auto border-b border-border/60 bg-background/50">
      <div className="flex gap-1 py-2 min-w-0">
        {folders.map((f) => {
          const active = f.id === currentFolderId;
          const unread = Math.max(0, f.unreadCount ?? 0);
          const badgeLabel = unread <= 0 ? "" : unread > 99 ? "99+" : String(unread);
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onFolderSelect(f.id)}
              className={cn(
                "shrink-0 relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors min-h-[var(--uix-touch-min)] inline-flex items-center gap-1.5",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
              aria-label={f.isMain ? `Основной чат: ${f.name}` : unread > 0 ? `${f.name}, ${unread} непрочитанных` : f.name}
              aria-pressed={active}
            >
              {f.name}
              {badgeLabel ? (
                <span className="inline-flex min-h-[14px] min-w-[14px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground">
                  {badgeLabel}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function lobbyCaption(participantCount: number, mediaType: GroupCallMedia): string {
  const kind = mediaType === "video" ? "видео" : "аудио";
  if (participantCount === 0) {
    return `Открыт групповой ${kind}звонок — можно подключаться`;
  }
  const n = participantCount;
  const word =
    n === 1 ? "участник" : n < 5 ? "участника" : "участников";
  return `Идёт групповой ${kind}звонок · ${n} ${word}`;
}

/** Баннер «в чате идёт созвон» с кнопкой подключения. */
export function ChatDetailGroupCallLobbyBanner({
  participantCount,
  mediaType,
  onJoin,
}: {
  participantCount: number;
  mediaType: GroupCallMedia;
  onJoin: () => void;
}) {
  return (
    <div className="shrink-0 uix-content-x py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/25 bg-primary/8 px-3 py-2.5">
        <p className="text-sm font-medium text-foreground min-w-0 flex-1">{lobbyCaption(participantCount, mediaType)}</p>
        <TapScaleButton
          type="button"
          className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground min-h-[var(--uix-touch-min)]"
          onClick={onJoin}
        >
          Подключиться
        </TapScaleButton>
      </div>
    </div>
  );
}
