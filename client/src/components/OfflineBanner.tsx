import { useState, useEffect, useRef } from "react";
import { WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/** Глобальный баннер «Нет подключения к интернету» (аудит п.50). */
export function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const { toast } = useToast();
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => {
      if (wasOfflineRef.current) toast({ title: "Соединение восстановлено" });
      wasOfflineRef.current = false;
      setOnline(true);
    };
    const handleOffline = () => {
      wasOfflineRef.current = true;
      setOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [toast]);

  if (online) return null;

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[300] flex items-center justify-center gap-1.5 border-b border-destructive/25 bg-destructive/95 px-3 py-1.5 text-xs font-medium text-destructive-foreground shadow-sm"
      style={{ paddingTop: "max(0.25rem, env(safe-area-inset-top))" }}
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
      <span>Нет подключения к интернету</span>
    </div>
  );
}
