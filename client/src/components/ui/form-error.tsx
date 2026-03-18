import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Единый вид ошибки в формах (Login, Onboarding и т.д.) — UIX консистентность */
export function FormError({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-[var(--uix-space-2)] p-[var(--uix-space-3)] rounded-lg bg-destructive/10 text-destructive text-[length:var(--uix-text-list-secondary)]",
        className
      )}
    >
      <AlertCircle className="size-4 shrink-0 mt-0.5" />
      <p className="leading-snug">{message}</p>
    </div>
  );
}
