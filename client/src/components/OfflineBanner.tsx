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
      className="fixed top-0 left-0 right-0 z-[300] flex items-center justify-center gap-2 py-2.5 px-4 bg-destructive text-destructive-foreground text-sm font-medium shadow-md"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      role="status"
      aria-live="polite"
    >
      <WifiOff className="w-4 h-4 flex-shrink-0" aria-hidden />
      <span>Нет подключения к интернету</span>
    </div>
  );
}
