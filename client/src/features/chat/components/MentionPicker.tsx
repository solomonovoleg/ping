/**
 * Выбор участника для @упоминания в групповом чате.
 * Показывается над полем ввода при вводе @.
 */
import { memo, useMemo } from "react";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import type { ApiChatMember } from "../types";

const memberDisplayName = (m: ApiChatMember) =>
  [m.displayName, m.surname].filter(Boolean).join(" ") || `ID ${m.publicId ?? ""}`;

type MentionPickerProps = {
  members: ApiChatMember[];
  query: string;
  onSelect: (member: ApiChatMember) => void;
  selectedIndex: number;
  onSelectedIndexChange: (i: number) => void;
  className?: string;
};

function MentionPickerInner({
  members,
  query,
  onSelect,
  selectedIndex,
  onSelectedIndexChange,
  className,
}: MentionPickerProps) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const name = memberDisplayName(m).toLowerCase();
      return name.includes(q);
    });
  }, [members, query]);

  if (filtered.length === 0) return null;

  const safeIndex = Math.max(0, Math.min(selectedIndex, filtered.length - 1));

  return (
    <div
      className={cn(
        "max-h-[min(200px,50vh)] overflow-y-auto rounded-lg border border-border/60 bg-popover shadow-lg",
        className
      )}
      role="listbox"
      aria-label="Участники для упоминания"
    >
      {filtered.map((m, i) => (
        <button
          key={m.id}
          type="button"
          role="option"
          aria-selected={i === safeIndex}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
            i === safeIndex ? "bg-primary/15 text-primary" : "hover:bg-muted/70"
          )}
          onClick={() => onSelect(m)}
          onMouseEnter={() => onSelectedIndexChange(Math.min(i, filtered.length - 1))}
        >
          <UserAvatar
            avatarUrl={m.avatarUrl ?? undefined}
            displayName={memberDisplayName(m)}
            seed={m.id}
            size={28}
            className="flex-shrink-0"
          />
          <span className="truncate">{memberDisplayName(m)}</span>
        </button>
      ))}
    </div>
  );
}

export const MentionPicker = memo(MentionPickerInner);
