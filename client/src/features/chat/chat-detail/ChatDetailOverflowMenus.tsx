import { forwardRef, type ReactNode } from "react";
import { Image, Link2, Users, Phone, Video, FolderPlus, ImagePlus, History } from "lucide-react";
import { isGroupCallModuleEnabled } from "@/features/group-call/flags";

/** Общая рамка меню под кнопкой «Ещё» в шапке чата (группа / личка). */
export const ChatDetailOverflowMenuShell = forwardRef<
  HTMLDivElement,
  { title: string; subtitle?: string; children: ReactNode }
>(function ChatDetailOverflowMenuShell({ title, subtitle, children }, ref) {
  return (
    <div
      ref={ref}
      className="absolute right-2 top-[calc(100%+8px)] z-[125] flex w-[280px] max-h-[min(70vh,420px)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/95 shadow-2xl backdrop-blur-xl"
    >
      <div className="shrink-0 border-b border-border/60 px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
        {subtitle ? <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">{children}</div>
    </div>
  );
});

export type ChatDetailGroupMenuBodyProps = {
  memberCount: number;
  myRole: string | undefined;
  uploadingGroupAvatar: boolean;
  onOpenMediaLinks: () => void;
  onOpenParticipants: () => void;
  /** Аудио / видео; родитель закрывает меню и вызывает group call. */
  onStartGroupCall: (video: boolean) => void;
  onCreateFolderClick: () => void;
  onPickGroupAvatar: () => void;
  /** Журнал созвонов на борде (не дублируем отдельный экран в шапке). */
  onOpenCallJournal: () => void;
  /** Нижний блок (обычно `ChatDetailAppearancePanel` в обёртке с border-t). */
  appearanceSection: ReactNode;
};

/** Пункты группового меню до блока внешнего вида. Без send/actions. */
export function ChatDetailGroupMenuBody({
  memberCount,
  myRole,
  uploadingGroupAvatar,
  onOpenMediaLinks,
  onOpenParticipants,
  onStartGroupCall,
  onCreateFolderClick,
  onPickGroupAvatar,
  onOpenCallJournal,
  appearanceSection,
}: ChatDetailGroupMenuBodyProps) {
  const groupCallOn = isGroupCallModuleEnabled();

  return (
    <>
      <button
        type="button"
        onClick={onOpenMediaLinks}
        className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/70"
      >
        <Image className="h-5 w-5 shrink-0 text-primary" />
        <span className="flex-1 text-sm font-medium">Медиафайлы и ссылки</span>
        <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      <button
        type="button"
        onClick={onOpenParticipants}
        className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/70 last:mb-0"
      >
        <Users className="h-5 w-5 shrink-0 text-primary" />
        <span className="flex-1 text-sm font-medium">Участники ({memberCount})</span>
      </button>
      {groupCallOn && (
        <>
          <button
            type="button"
            onClick={() => onStartGroupCall(false)}
            className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/70"
          >
            <Phone className="h-5 w-5 shrink-0 text-primary" />
            <span className="flex-1 text-sm font-medium">Групповой звонок</span>
          </button>
          <button
            type="button"
            onClick={() => onStartGroupCall(true)}
            className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/70"
          >
            <Video className="h-5 w-5 shrink-0 text-primary" />
            <span className="flex-1 text-sm font-medium">Групповое видео</span>
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onOpenCallJournal}
        className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/70"
      >
        <History className="h-5 w-5 shrink-0 text-primary" />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
          <span className="text-sm font-medium">Журнал созвонов</span>
          <span className="text-[11px] text-muted-foreground leading-tight">Борд — недавние и титры</span>
        </div>
      </button>
      {myRole === "admin" && (
        <button
          type="button"
          onClick={onCreateFolderClick}
          className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/70 last:mb-0"
        >
          <FolderPlus className="h-5 w-5 shrink-0 text-primary" />
          <span className="flex-1 text-sm font-medium">Создать папку</span>
        </button>
      )}
      <button
        type="button"
        disabled={uploadingGroupAvatar}
        onClick={onPickGroupAvatar}
        className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/70 last:mb-0 disabled:opacity-60"
      >
        <ImagePlus className="h-5 w-5 shrink-0 text-primary" />
        <span className="flex-1 text-sm font-medium">
          {uploadingGroupAvatar ? "Загрузка…" : "Загрузить аватар группы"}
        </span>
      </button>
      {appearanceSection}
    </>
  );
}
