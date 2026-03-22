import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { GroupCallMedia } from "@/lib/group-calls-api";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

export type ChatDetailGroupFolderTab = {
  id: string;
  name: string;
  isMain: boolean;
  unreadCount?: number;
  messageCount?: number;
};

const FOLDER_LONG_PRESS_MS = 720;
const LONG_PRESS_MOVE_CANCEL_PX = 14;

/** Горизонтальная полоса папок в групповом чате: только папки с сообщениями (+ текущая пустая), «+», удержание → редактирование. */
export function ChatDetailGroupFolderStrip({
  folders,
  currentFolderId,
  onFolderSelect,
  canManageFolders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: {
  folders: ChatDetailGroupFolderTab[];
  currentFolderId: string | null;
  onFolderSelect: (folderId: string) => void;
  canManageFolders: boolean;
  onCreateFolder: () => void;
  onRenameFolder: (folder: ChatDetailGroupFolderTab) => void;
  onDeleteFolder: (folder: ChatDetailGroupFolderTab) => void;
}) {
  const [sheetFolder, setSheetFolder] = useState<ChatDetailGroupFolderTab | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressOriginRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressOriginRef.current = null;
  }, []);

  const openFolderActions = useCallback(
    (f: ChatDetailGroupFolderTab) => {
      if (!canManageFolders || f.isMain) return;
      setSheetFolder(f);
    },
    [canManageFolders],
  );

  if (folders.length === 0) return null;

  return (
    <>
      <div className="shrink-0 uix-content-x border-b border-border/60 bg-background">
        <div className="flex min-w-0 items-center gap-1 py-2">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto touch-pan-x">
            {folders.map((f) => {
              const active = f.id === currentFolderId;
              const unread = Math.max(0, f.unreadCount ?? 0);
              const badgeLabel = unread <= 0 ? "" : unread > 99 ? "99+" : String(unread);
              const canLongPress = canManageFolders && !f.isMain;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onFolderSelect(f.id)}
                  onPointerDown={(e) => {
                    if (!canLongPress || e.button !== 0) return;
                    longPressOriginRef.current = { x: e.clientX, y: e.clientY };
                    longPressTimerRef.current = setTimeout(() => {
                      longPressTimerRef.current = null;
                      longPressOriginRef.current = null;
                      void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                      openFolderActions(f);
                    }, FOLDER_LONG_PRESS_MS);
                  }}
                  onPointerMove={(e) => {
                    const o = longPressOriginRef.current;
                    if (!o || !longPressTimerRef.current) return;
                    const dx = e.clientX - o.x;
                    const dy = e.clientY - o.y;
                    if (dx * dx + dy * dy > LONG_PRESS_MOVE_CANCEL_PX * LONG_PRESS_MOVE_CANCEL_PX) {
                      clearLongPress();
                    }
                  }}
                  onPointerUp={clearLongPress}
                  onPointerLeave={clearLongPress}
                  onPointerCancel={clearLongPress}
                  onContextMenu={(e) => {
                    if (!canLongPress) return;
                    e.preventDefault();
                    openFolderActions(f);
                  }}
                  className={cn(
                    "relative inline-flex min-h-[var(--uix-touch-min)] shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                  aria-label={f.isMain ? `Основной чат: ${f.name}` : unread > 0 ? `${f.name}, ${unread} непрочитанных` : f.name}
                  aria-pressed={active}
                >
                  {f.name}
                  {badgeLabel ? (
                    <span
                      className={cn(
                        "inline-flex min-h-[14px] min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-semibold leading-none",
                        active ? "bg-primary-foreground/25 text-primary-foreground" : "bg-primary/90 text-primary-foreground",
                      )}
                    >
                      {badgeLabel}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {canManageFolders ? (
            <TapScaleButton
              type="button"
              haptic
              onClick={onCreateFolder}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-secondary/50 text-foreground transition-colors hover:bg-secondary min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]"
              aria-label="Создать папку"
              title="Новая папка"
            >
              <Plus className="h-5 w-5" strokeWidth={2.25} />
            </TapScaleButton>
          ) : null}
        </div>
      </div>

      <Drawer open={sheetFolder != null} onOpenChange={(o) => !o && setSheetFolder(null)}>
        <DrawerContent className="max-h-[50vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Папка «{sheetFolder?.name ?? ""}»</DrawerTitle>
            <p className="text-sm text-muted-foreground">Удерживайте вкладку папки, чтобы открыть это меню</p>
          </DrawerHeader>
          <div className="flex flex-col gap-2 px-4 pb-6">
            <Button
              type="button"
              variant="secondary"
              className="w-full justify-start gap-2"
              onClick={() => {
                const f = sheetFolder;
                setSheetFolder(null);
                if (f) onRenameFolder(f);
              }}
            >
              <Pencil className="h-4 w-4" aria-hidden />
              Переименовать
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="w-full justify-start gap-2"
              onClick={() => {
                const f = sheetFolder;
                setSheetFolder(null);
                if (f) onDeleteFolder(f);
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Удалить папку
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function lobbyCaption(participantCount: number, mediaType: GroupCallMedia): string {
  const kind = mediaType === "video" ? "видео" : "аудио";
  if (participantCount === 0) {
    return `Открыт групповой ${kind}звонок — можно подключаться`;
  }
  const n = participantCount;
  const word = n === 1 ? "участник" : n < 5 ? "участника" : "участников";
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
        <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{lobbyCaption(participantCount, mediaType)}</p>
        <TapScaleButton
          type="button"
          className="min-h-[var(--uix-touch-min)] shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          onClick={onJoin}
        >
          Подключиться
        </TapScaleButton>
      </div>
    </div>
  );
}
