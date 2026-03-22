/**
 * Выбор участника для @упоминания в групповом чате.
 * Показывается над полем ввода при вводе @.
 */
import { memo, useMemo } from "react";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import type { ApiChatMember } from "../types";
import { buildMentionList, memberDisplayName, type MentionListEntry } from "./mention-list";

type MentionPickerProps = {
  members: ApiChatMember[];
  query: string;
  onSelect: (member: ApiChatMember) => void;
  /** Строка «Все участники» → вставка @all (внимание в группе) */
  onPickEveryone?: () => void;
  /** Показывать пункт «Все участники» (только группа) */
  includeEveryone?: boolean;
  selectedIndex: number;
  onSelectedIndexChange: (i: number) => void;
  className?: string;
};

function MentionPickerInner({
  members,
  query,
  onSelect,
  onPickEveryone,
  includeEveryone,
  selectedIndex,
  onSelectedIndexChange,
  className,
}: MentionPickerProps) {
  const rows: MentionListEntry[] = useMemo(
    () => buildMentionList(members, query, { includeEveryone: includeEveryone && !!onPickEveryone }),
    [members, query, includeEveryone, onPickEveryone],
  );

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/60 bg-popover px-3 py-2.5 text-sm text-muted-foreground shadow-lg",
          className,
        )}
        role="status"
      >
        Нет совпадений — попробуйте имя или публичный id
      </div>
    );
  }

  const safeIndex = Math.max(0, Math.min(selectedIndex, rows.length - 1));

  const renderRow = (entry: MentionListEntry, i: number) => {
    if (entry.kind === "everyone") {
      return (
        <button
          key="__everyone__"
          type="button"
          role="option"
          aria-selected={i === safeIndex}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
            i === safeIndex ? "bg-primary/15 text-primary" : "hover:bg-muted/70",
          )}
          onClick={() => onPickEveryone?.()}
          onMouseEnter={() => onSelectedIndexChange(i)}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold">
            @
          </span>
          <span className="truncate font-medium">Все участники</span>
          <span className="ml-auto text-[11px] text-muted-foreground">@all</span>
        </button>
      );
    }
    const m = entry.member;
    return (
      <button
        key={m.id}
        type="button"
        role="option"
        aria-selected={i === safeIndex}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
          i === safeIndex ? "bg-primary/15 text-primary" : "hover:bg-muted/70",
        )}
        onClick={() => onSelect(m)}
        onMouseEnter={() => onSelectedIndexChange(i)}
      >
        <UserAvatar
          avatarUrl={m.avatarUrl ?? undefined}
          displayName={memberDisplayName(m)}
          seed={m.id}
          size={28}
          className="flex-shrink-0"
        />
        <span className="min-w-0 truncate">{memberDisplayName(m)}</span>
        {m.publicId != null ? (
          <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">id{m.publicId}</span>
        ) : null}
      </button>
    );
  };

  return (
    <div
      className={cn(
        "max-h-[min(220px,50vh)] overflow-y-auto rounded-lg border border-border/60 bg-popover shadow-lg",
        className,
      )}
      role="listbox"
      aria-label="Участники для упоминания"
    >
      {rows.map((entry, i) => renderRow(entry, i))}
    </div>
  );
}

export const MentionPicker = memo(MentionPickerInner);
