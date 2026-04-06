import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { triggerLightHaptic } from "@/lib/capacitor-native";

type BeforeInstallPromptEventLike = {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

/** Кнопка установки PWA, если браузер отдал `beforeinstallprompt` (часто Chrome/Android). На iOS события нет — только инструкции в тексте. */
export function PwaInstallButton({ className }: { className?: string }) {
  const { toast } = useToast();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEventLike | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isIosSafari() || isStandalone()) {
      setHidden(true);
      return;
    }
    const onEvt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as unknown as BeforeInstallPromptEventLike);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onEvt);
    return () => window.removeEventListener("beforeinstallprompt", onEvt);
  }, []);

  if (hidden && !deferred) return null;

  return (
    <Button
      type="button"
      className={className}
      disabled={!deferred}
      onClick={() => {
        void triggerLightHaptic();
        if (!deferred) {
          toast({
            title: "Установка из меню",
            description: "Откройте меню браузера (⋮) и выберите «Добавить на главный экран» или «Установить приложение».",
          });
          return;
        }
        void deferred.prompt();
        void deferred.userChoice.then(() => {
          setDeferred(null);
          setHidden(true);
        });
      }}
    >
      <Download className="mr-2 h-4 w-4" />
      {deferred ? "Установить как приложение" : "Как установить без кнопки"}
    </Button>
  );
}
