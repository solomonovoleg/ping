import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const accentIconWrap: Record<"violet" | "emerald" | "amber" | "rose" | "sky", string> = {
  violet: "bg-[hsl(262_72%_58%/0.2)] text-[hsl(262_80%_72%)]",
  emerald: "bg-[hsl(152_65%_40%/0.2)] text-[hsl(152_70%_58%)]",
  amber: "bg-[hsl(38_92%_50%/0.18)] text-[hsl(43_96%_62%)]",
  rose: "bg-[hsl(350_75%_52%/0.2)] text-[hsl(350_80%_68%)]",
  sky: "bg-[hsl(199_85%_48%/0.2)] text-[hsl(199_90%_65%)]",
};

export type AdminStatCardProps = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  accent?: keyof typeof accentIconWrap;
  trend?: { label: string; positive?: boolean };
  className?: string;
};

export function AdminStatCard({
  label,
  value,
  icon: Icon,
  accent = "violet",
  trend,
  className,
}: AdminStatCardProps) {
  return (
    <div className={cn("admin-surface-card p-4 sm:p-5", className)}>
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            accentIconWrap[accent]
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm admin-text-muted">{label}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-[hsl(210_20%_98%)]">
              {value}
            </p>
            {trend ? (
              <span
                className={cn(
                  "text-xs font-medium tabular-nums rounded-md px-2 py-0.5",
                  trend.positive === false
                    ? "bg-[hsl(0_62%_42%/0.2)] text-[hsl(0_80%_70%)]"
                    : "bg-[hsl(152_65%_40%/0.2)] text-[hsl(152_75%_58%)]"
                )}
              >
                {trend.label}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
