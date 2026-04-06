import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EdgeLeaderboardEntry } from "@/lib/edge-participant";
import { emoneyDisplayInitial } from "./emoney-avatar-letter";

function medalForIndex(index: number): string {
  if (index === 0) return "👑";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `#${index + 1}`;
}

type Props = {
  entries: EdgeLeaderboardEntry[];
  myRank: number | null;
  myXp: number | null;
  myDisplayName: string;
  maxRows?: number;
  compact?: boolean;
};

export function EdgeMoneyLeaderboardRows({
  entries,
  myRank,
  myXp,
  myDisplayName,
  maxRows,
  compact,
}: Props) {
  const slice = typeof maxRows === "number" ? entries.slice(0, maxRows) : entries;
  return (
    <div className="space-y-1">
      {slice.map((p, index) => (
        <div
          key={`${p.rank}-${p.displayName ?? index}`}
          className={cn(
            "flex items-center justify-between rounded-2xl p-2.5 transition-colors hover:bg-white/5",
            compact && "p-2",
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "w-7 shrink-0 text-center text-sm font-bold",
                index === 0
                  ? "text-yellow-400"
                  : index === 1
                    ? "text-zinc-300"
                    : index === 2
                      ? "text-amber-500"
                      : "text-white/45 text-xs",
              )}
            >
              {medalForIndex(index)}
            </div>
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                index === 0
                  ? "border-yellow-400/40 bg-yellow-400/15 text-yellow-300"
                  : index === 1
                    ? "border-zinc-400/35 bg-zinc-400/15 text-zinc-200"
                    : index === 2
                      ? "border-amber-500/35 bg-amber-500/15 text-amber-200"
                      : "border-white/10 bg-white/10 text-white/90",
              )}
            >
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                emoneyDisplayInitial(p.displayName)
              )}
            </div>
            <span className="truncate text-sm font-medium text-white/90">{p.displayName ?? "Участник"}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-xl bg-white/5 px-2.5 py-1">
            <Star className="h-3.5 w-3.5 emoney-accent" style={{ fill: "var(--emoney-accent)" }} aria-hidden />
            <span className="text-sm font-bold text-white">{p.xp}</span>
          </div>
        </div>
      ))}
      {myRank != null && myXp != null ? (
        <div className="mt-2 border-t border-white/10 pt-2">
          <div className="flex items-center justify-between rounded-2xl emoney-accent-soft-bg p-2.5" style={{ border: "1px solid var(--emoney-accent)" }}>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="w-7 shrink-0 text-center text-sm font-bold emoney-accent">#{myRank}</span>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full emoney-accent-soft-bg text-xs font-bold text-white" style={{ border: "1px solid var(--emoney-accent)" }}>
                {emoneyDisplayInitial(myDisplayName)}
              </div>
              <div className="min-w-0">
                <span className="block truncate text-sm font-bold text-white">{myDisplayName || "Вы"}</span>
                <span className="text-[11px] emoney-badge-text">Ваше место</span>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 px-2.5 py-1">
              <Star className="h-3.5 w-3.5 emoney-accent" style={{ fill: "var(--emoney-accent)" }} aria-hidden />
              <span className="text-sm font-bold text-white">{myXp}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
