import { Share2, Archive, Trash2, Pin, Flag } from "lucide-react";

export function StoryViewerActionsSheet({
  open,
  onDismiss,
  actionError,
  actionsBusy,
  shareDisabled,
  onShare,
  showAddToPinned,
  onAddToPinned,
  showArchive,
  onArchive,
  showDelete,
  confirmDelete,
  onRequestDeleteConfirm,
  onCancelDeleteConfirm,
  onConfirmDelete,
  showReport,
  onReport,
  reportLabel,
}: {
  open: boolean;
  onDismiss: () => void;
  actionError: string | null;
  actionsBusy: boolean;
  shareDisabled: boolean;
  onShare: () => void;
  showAddToPinned: boolean;
  onAddToPinned: () => void;
  showArchive: boolean;
  onArchive: () => void;
  showDelete: boolean;
  confirmDelete: boolean;
  onRequestDeleteConfirm: () => void;
  onCancelDeleteConfirm: () => void;
  onConfirmDelete: () => void;
  /** Чужая сториз: жалоба (блок 1 — store-moderation). */
  showReport?: boolean;
  onReport?: () => void;
  reportLabel?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-[360] flex items-end bg-black/50 px-3 pt-3 pb-[max(var(--uix-space-3),calc(env(safe-area-inset-bottom,0px)+var(--uix-space-2)))] backdrop-blur-sm"
      onClick={(e) => {
        e.stopPropagation();
        onDismiss();
      }}
    >
      <div
        className="w-full uix-responsive-max-w rounded-t-[24px] border border-white/10 bg-[rgba(10,8,24,0.97)] p-2 text-white shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="flex w-full min-h-[var(--uix-touch-min)] items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white/90 hover:bg-white/10"
          onClick={onShare}
          disabled={actionsBusy || shareDisabled}
        >
          <Share2 className="h-4 w-4" />
          Поделиться сториз
        </button>
        {showReport && onReport ? (
          <button
            type="button"
            className="flex w-full min-h-[var(--uix-touch-min)] items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-amber-200/95 hover:bg-white/10"
            aria-label={reportLabel ?? "Пожаловаться на сториз"}
            onClick={() => {
              onReport();
              onDismiss();
            }}
            disabled={actionsBusy}
          >
            <Flag className="h-4 w-4" aria-hidden />
            {reportLabel ?? "Пожаловаться"}
          </button>
        ) : null}
        {showAddToPinned ? (
          <button
            type="button"
            className="flex w-full min-h-[var(--uix-touch-min)] items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white/90 hover:bg-white/10"
            onClick={() => {
              onAddToPinned();
              onDismiss();
            }}
            disabled={actionsBusy}
          >
            <Pin className="h-4 w-4" />
            В закреплённое
          </button>
        ) : null}
        {showArchive ? (
          <button
            type="button"
            className="flex w-full min-h-[var(--uix-touch-min)] items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white/90 hover:bg-white/10"
            onClick={onArchive}
            disabled={actionsBusy}
          >
            <Archive className="h-4 w-4" />
            Архивировать
          </button>
        ) : null}
        {showDelete ? (
          <>
            {!confirmDelete ? (
              <button
                type="button"
                className="flex w-full min-h-[var(--uix-touch-min)] items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-red-300 hover:bg-red-500/15"
                onClick={onRequestDeleteConfirm}
                disabled={actionsBusy}
              >
                <Trash2 className="h-4 w-4" />
                Удалить сториз
              </button>
            ) : (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-3">
                <p className="text-[12px] text-red-200">Удалить сториз без возможности восстановления?</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="min-h-[var(--uix-touch-min)] rounded-lg bg-red-500/80 px-3 py-2 text-xs font-medium text-white hover:bg-red-500"
                    onClick={onConfirmDelete}
                    disabled={actionsBusy}
                  >
                    Да, удалить
                  </button>
                  <button
                    type="button"
                    className="min-h-[var(--uix-touch-min)] rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white/90 hover:bg-white/20"
                    onClick={onCancelDeleteConfirm}
                    disabled={actionsBusy}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
        <button
          type="button"
          className="mt-1 flex w-full min-h-[var(--uix-touch-min)] items-center justify-center rounded-xl px-3 py-3 text-sm text-white/70 hover:bg-white/10"
          onClick={onDismiss}
        >
          Отмена
        </button>
        {actionError ? <p className="px-3 pb-2 pt-1 text-[11px] text-red-300">{actionError}</p> : null}
      </div>
    </div>
  );
}
