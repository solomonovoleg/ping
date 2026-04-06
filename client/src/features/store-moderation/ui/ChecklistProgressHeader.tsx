import { Progress } from "@/components/ui/progress";

export function ChecklistProgressHeader({
  title,
  description,
  done,
  total,
  percent,
  progressAriaLabel,
}: {
  title: string;
  description: string;
  done: number;
  total: number;
  percent: number;
  progressAriaLabel: string;
}) {
  return (
    <>
      <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">{title}</h2>
      <p className="mt-1 text-sm admin-text-muted">{description}</p>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs text-[hsl(210_12%_62%)]">
          <span>
            Прогресс: {done}/{total}
          </span>
          <span>{percent}%</span>
        </div>
        <Progress value={percent} aria-label={progressAriaLabel} />
      </div>
    </>
  );
}
