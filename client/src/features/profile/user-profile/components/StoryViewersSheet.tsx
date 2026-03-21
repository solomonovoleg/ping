import { ChevronLeft, Eye } from "lucide-react";
import { formatPostTime } from "@/lib/posts";
import type { StoryViewerUser } from "@/lib/stories";
import { UserAvatar } from "@/components/UserAvatar";
import { ListEmptyState } from "@/components/ui/empty";
import { userProfileRu } from "../i18n.ru";

export function StoryViewersSheet({
  open,
  onClose,
  loading,
  viewers,
  onOpenProfile,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  viewers: StoryViewerUser[];
  onOpenProfile: (viewer: StoryViewerUser) => void;
}) {
  const v = userProfileRu.viewersSheet;
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[380] flex items-end bg-black/50 px-0 pt-3 pb-[max(var(--uix-space-3),calc(env(safe-area-inset-bottom,0px)+var(--uix-space-2)))] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-auto w-full max-w-[480px] overflow-hidden rounded-t-[28px] border border-white/10 bg-[rgba(10,8,24,0.97)] text-white shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 pt-1">
          <div className="flex flex-col gap-0.5">
            <p className="text-base font-extrabold tracking-tight text-white">{v.title}</p>
            <p className="text-xs text-white/45">{v.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full bg-white/[0.08] text-white/70 hover:bg-white/[0.12]"
            aria-label={v.closeList}
          >
            <ChevronLeft className="h-4 w-4 rotate-180" />
          </button>
        </div>
        <div className="max-h-[52vh] overflow-y-auto px-3 pb-4">
          {loading ? (
            <div className="px-3 py-4 text-sm text-white/55">{v.loading}</div>
          ) : viewers.length === 0 ? (
            <ListEmptyState
              icon={Eye}
              title={v.emptyTitle}
              description={v.emptyDesc}
              className="border-none text-white [&_svg]:text-white/70 [&_p]:text-white/55"
            />
          ) : (
            viewers.map((viewer) => (
              <button
                key={viewer.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border-b border-white/[0.06] px-2 py-2.5 text-left last:border-b-0 hover:bg-white/[0.06]"
                onClick={() => onOpenProfile(viewer)}
              >
                <UserAvatar
                  avatarUrl={viewer.avatarUrl ?? undefined}
                  displayName={[viewer.displayName, viewer.surname].filter(Boolean).join(" ") || `ID ${viewer.publicId}`}
                  seed={viewer.id}
                  size={36}
                  className="h-9 w-9"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {[viewer.displayName, viewer.surname].filter(Boolean).join(" ") || `ID ${viewer.publicId}`}
                  </p>
                  <p className="text-xs text-white/45">{formatPostTime(viewer.viewedAt)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
