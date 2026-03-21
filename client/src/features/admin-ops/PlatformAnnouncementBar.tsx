import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchPublicAnnouncement } from "./api";

export function PlatformAnnouncementBar() {
  const { data } = useQuery({
    queryKey: ["platform", "announcement"],
    queryFn: fetchPublicAnnouncement,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  if (!data) return null;

  const showBanner = data.banner?.enabled && (data.banner.text?.trim() ?? "").length > 0;
  const showMaint = data.maintenanceMode;

  if (!showBanner && !showMaint) return null;

  const variant = data.banner?.variant ?? "info";
  const barClass =
    variant === "danger"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : variant === "warning"
        ? "bg-amber-500/15 text-amber-950 dark:text-amber-100 border-amber-500/30"
        : "bg-primary/10 text-foreground border-primary/20";

  return (
    <div className="shrink-0 space-y-1 px-3 pt-2 pb-1 border-b border-border/40">
      {showMaint ? (
        <div
          className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm bg-muted/80 border-border"
          role="status"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 opacity-80" aria-hidden />
          <span>Идут технические работы: новые регистрации временно недоступны.</span>
        </div>
      ) : null}
      {showBanner ? (
        <div
          className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", barClass)}
          role="status"
        >
          <Info className="w-4 h-4 shrink-0 mt-0.5 opacity-80" aria-hidden />
          <span className="whitespace-pre-wrap break-words">{data.banner.text}</span>
        </div>
      ) : null}
    </div>
  );
}
