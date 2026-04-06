import { useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion, DURATION_FAST_MS, EASING_OUT_BEZIER } from "@/lib/motion";
import type { ContactUser } from "@/lib/users";

function rowName(u: ContactUser) {
  return [u.displayName, u.surname].filter(Boolean).join(" ") || `ID ${u.publicId}`;
}

export function CommentMentionSuggestPanel({
  open,
  candidates,
  selectedIndex,
  searching,
  topPickCount,
  onPick,
  onHoverIndex,
  listId,
}: {
  open: boolean;
  candidates: ContactUser[];
  selectedIndex: number;
  searching: boolean;
  topPickCount: number;
  onPick: (u: ContactUser) => void;
  onHoverIndex: (i: number) => void;
  listId: string;
}) {
  const reduced = usePrefersReducedMotion();
  const safe = candidates.length ? Math.min(selectedIndex, candidates.length - 1) : 0;
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || candidates.length === 0) return;
    const root = scrollRef.current;
    if (!root) return;
    const row = root.querySelector<HTMLElement>(`[data-mention-row="${safe}"]`);
    row?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [open, safe, candidates.length, reduced]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={scrollRef}
          id={listId}
          role="listbox"
          aria-label="Упомянуть пользователя"
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: 4 }}
          transition={{ duration: DURATION_FAST_MS / 1000, ease: EASING_OUT_BEZIER }}
          className="max-h-[min(240px,42vh)] overflow-y-auto rounded-xl border border-border/60 bg-popover/95 backdrop-blur-md shadow-xl"
        >
          {searching && candidates.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground" role="status">
              Ищем…
            </div>
          ) : candidates.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground" role="status">
              Нет совпадений — имя или публичный id
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-[1] border-b border-border/40 bg-popover/95 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {candidates.length && !searching ? "Контакты и подписки — прокрутите всех" : "Выберите человека"}
              </div>
              <ul className="py-1">
                {candidates.map((u, i) => (
                  <li key={u.id}>
                    {i === topPickCount && candidates.length > topPickCount ? (
                      <div
                        className="mx-2 my-1 h-px bg-border/60"
                        aria-hidden
                        role="separator"
                      />
                    ) : null}
                    <button
                      type="button"
                      role="option"
                      data-mention-row={i}
                      aria-selected={i === safe}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[14px] transition-colors min-h-[var(--uix-touch-min)]",
                        i < topPickCount && i === safe ? "bg-primary/12" : "",
                        i === safe ? "bg-primary/15 text-primary" : "hover:bg-muted/70",
                      )}
                      onMouseEnter={() => onHoverIndex(i)}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => onPick(u)}
                    >
                      <UserAvatar
                        avatarUrl={u.avatarUrl ?? undefined}
                        displayName={rowName(u)}
                        seed={u.id}
                        size={32}
                        className="shrink-0"
                        pointerEventsNone
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{rowName(u)}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        id{u.publicId}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
