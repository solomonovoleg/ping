import { Copy, Settings, UserCheck, UserX, Flag } from "lucide-react";
import { userProfileRu } from "../i18n.ru";

export function UserProfileMoreSheet({
  open,
  onClose,
  isMe,
  onCopyLink,
  onOpenSettings,
  onReportUser,
  onBlockUser,
  isBlockedByMe,
  onUnblockUser,
}: {
  open: boolean;
  onClose: () => void;
  isMe: boolean;
  onCopyLink: () => void;
  onOpenSettings: () => void;
  /** Чужой профиль: жалоба (store-moderation block-01) */
  onReportUser?: () => void;
  /** Чужой профиль: открыть сценарий блокировки */
  onBlockUser?: () => void;
  /** Вы заблокировали этого пользователя */
  isBlockedByMe?: boolean;
  onUnblockUser?: () => void;
}) {
  const m = userProfileRu.moreSheet;
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 px-3 pb-[max(var(--uix-space-3),calc(env(safe-area-inset-bottom,0px)+var(--uix-space-2)))]"
      role="dialog"
      aria-modal="true"
      aria-label={m.ariaProfileActions}
      onClick={onClose}
    >
      <div
        className="uix-responsive-max-w rounded-2xl border border-border bg-background p-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-secondary min-h-[var(--uix-touch-min)]"
          onClick={() => {
            onCopyLink();
            onClose();
          }}
        >
          <Copy className="h-4 w-4 shrink-0" aria-hidden />
          {m.copyLink}
        </button>
        {isMe ? (
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-secondary min-h-[var(--uix-touch-min)]"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
          >
            <Settings className="h-4 w-4 shrink-0" aria-hidden />
            {m.settings}
          </button>
        ) : null}
        {!isMe && onReportUser ? (
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-secondary min-h-[var(--uix-touch-min)]"
            onClick={() => {
              onClose();
              requestAnimationFrame(() => onReportUser());
            }}
          >
            <Flag className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {m.reportUser}
          </button>
        ) : null}
        {!isMe && isBlockedByMe && onUnblockUser ? (
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-secondary min-h-[var(--uix-touch-min)]"
            onClick={() => {
              onClose();
              onUnblockUser();
            }}
          >
            <UserCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {m.unblockUser}
          </button>
        ) : null}
        {!isMe && !isBlockedByMe && onBlockUser ? (
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-destructive hover:bg-destructive/10 min-h-[var(--uix-touch-min)]"
            onClick={() => {
              onClose();
              onBlockUser();
            }}
          >
            <UserX className="h-4 w-4 shrink-0" aria-hidden />
            {m.blockUser}
          </button>
        ) : null}
        <button
          type="button"
          className="mt-1 flex w-full items-center justify-center rounded-xl py-3 text-sm text-muted-foreground min-h-[var(--uix-touch-min)]"
          onClick={onClose}
        >
          {m.close}
        </button>
      </div>
    </div>
  );
}
