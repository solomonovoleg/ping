import { useState, useEffect, useCallback } from "react";
import { Loader2, Mic, Sparkles, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStoryBeautyEnabled, setStoryBeautyEnabled } from "@/lib/story-prefs";
import {
  primeMicrophoneCapture,
  primeCameraAndMicrophoneCapture,
} from "@/lib/media-capture-prime";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SettingsScreenShell } from "@/features/settings/components/SettingsScreenShell";

type MediaPermissionState = PermissionState | "unknown";

function permissionBadgeClass(state: MediaPermissionState): string {
  if (state === "granted") return "bg-emerald-500/15 text-emerald-500";
  if (state === "denied") return "bg-destructive/15 text-destructive";
  if (state === "prompt") return "bg-amber-500/15 text-amber-600 dark:text-amber-500";
  return "bg-muted text-muted-foreground";
}

function permissionShortLabel(state: MediaPermissionState): string {
  if (state === "granted") return "Активно";
  if (state === "denied") return "Запрещено";
  if (state === "prompt") return "При использовании";
  return "Статус неизвестен";
}

function cameraMicCombinedLabel(mic: MediaPermissionState, cam: MediaPermissionState): string {
  if (mic === "granted" && cam === "granted") return "Активно";
  if (mic === "denied" || cam === "denied") return "Есть запрет";
  if (mic === "prompt" || cam === "prompt") return "При использовании";
  return "Статус неизвестен";
}

function cameraMicCombinedClass(mic: MediaPermissionState, cam: MediaPermissionState): string {
  if (mic === "granted" && cam === "granted") return "bg-emerald-500/15 text-emerald-500";
  if (mic === "denied" || cam === "denied") return "bg-destructive/15 text-destructive";
  if (mic === "prompt" || cam === "prompt") return "bg-amber-500/15 text-amber-600 dark:text-amber-500";
  return "bg-muted text-muted-foreground";
}

export default function SettingsMedia() {
  const { toast } = useToast();
  const [storyBeauty, setStoryBeautyState] = useState(getStoryBeautyEnabled);
  const [mediaPrimeBusy, setMediaPrimeBusy] = useState<null | "mic" | "cam">(null);
  const [microphonePermission, setMicrophonePermission] = useState<MediaPermissionState>("unknown");
  const [cameraPermission, setCameraPermission] = useState<MediaPermissionState>("unknown");

  const readPermissionState = async (name: "microphone" | "camera"): Promise<MediaPermissionState> => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unknown";
    try {
      const status = await navigator.permissions.query({ name: name as PermissionName });
      return status.state;
    } catch {
      return "unknown";
    }
  };

  const refreshMediaPermissionStates = useCallback(async () => {
    const [micState, camState] = await Promise.all([
      readPermissionState("microphone"),
      readPermissionState("camera"),
    ]);
    setMicrophonePermission(micState);
    setCameraPermission(camState);
  }, []);

  useEffect(() => {
    void refreshMediaPermissionStates();
  }, [refreshMediaPermissionStates]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    void (async () => {
      for (const name of ["microphone", "camera"] as const) {
        try {
          const status = await navigator.permissions.query({ name: name as PermissionName });
          const onChange = () => {
            if (!cancelled) void refreshMediaPermissionStates();
          };
          status.addEventListener("change", onChange);
          cleanups.push(() => status.removeEventListener("change", onChange));
        } catch {
          /* Safari / часть WebView — query не поддерживается */
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const fn of cleanups) fn();
    };
  }, [refreshMediaPermissionStates]);

  const runPrimeMicrophone = async () => {
    setMediaPrimeBusy("mic");
    try {
      const r = await primeMicrophoneCapture();
      if (r === "granted") {
        toast({
          title: "Микрофон разрешён",
          description: "Тот же доступ будет использоваться для звонков, голосовых и распознавания речи.",
        });
      } else if (r === "denied") {
        toast({
          title: "Доступ к микрофону не дан",
          description:
            "Значок замка слева от адреса → разрешения сайта → микрофон «Разрешить». Обновите страницу и повторите.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Микрофон недоступен",
          description: "Проверьте HTTPS и поддержку браузера.",
          variant: "destructive",
        });
      }
    } finally {
      await refreshMediaPermissionStates();
      setMediaPrimeBusy(null);
    }
  };

  const runPrimeCameraMic = async () => {
    setMediaPrimeBusy("cam");
    try {
      const r = await primeCameraAndMicrophoneCapture();
      if (r === "granted") {
        toast({
          title: "Камера и микрофон разрешены",
          description: "Подходит для видеозвонков и съёмки в веб-версии.",
        });
      } else if (r === "denied") {
        toast({
          title: "Доступ не дан",
          description:
            "Замок в адресной строке → настройки сайта → камера и микрофон «Разрешить». Обновите страницу и повторите.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Не удалось получить доступ",
          description: "Проверьте устройство и ограничения браузера.",
          variant: "destructive",
        });
      }
    } finally {
      await refreshMediaPermissionStates();
      setMediaPrimeBusy(null);
    }
  };

  return (
    <SettingsScreenShell title="Камера и микрофон">
      <div className="min-w-0 rounded-2xl border border-border/50 bg-card p-4 shadow-sm space-y-3">
        <p className="text-sm text-muted-foreground">
          Если статус «Статус неизвестен», в Safari и части встроенных браузеров это нормально: API не показывает
          разрешение, хотя после запроса доступ звонок может работать.
        </p>
        {(microphonePermission === "denied" || cameraPermission === "denied") && (
          <div
            role="status"
            className="rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2.5 text-sm text-foreground"
          >
            <p className="font-medium text-destructive">Браузер запретил доступ для этого сайта</p>
            <p className="mt-1.5 text-muted-foreground leading-relaxed">
              Нажмите значок <strong className="text-foreground">замка</strong> или <strong className="text-foreground">«i»</strong> слева
              от адреса → пункт про разрешения / «Настройки сайта» → для <strong className="text-foreground">микрофона</strong> и{" "}
              <strong className="text-foreground">камеры</strong> выберите «Разрешить», не «Блокировать». Затем обновите страницу и
              снова нажмите кнопку проверки выше.
            </p>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              В Windows: «Параметры» → «Конфиденциальность и защита» → «Микрофон» / «Камера» — доступ для приложений
              включён, для браузера не выключен.
            </p>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-border/50 min-h-[var(--uix-touch-min)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-medium text-foreground">Beauty для кружков</span>
          </div>
          <Switch
            checked={storyBeauty}
            onCheckedChange={(checked) => {
              setStoryBeautyEnabled(checked);
              setStoryBeautyState(checked);
            }}
            className="shrink-0"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="secondary"
            className="flex h-auto min-h-[var(--uix-touch-min)] w-full min-w-0 justify-between gap-2 whitespace-normal sm:flex-1"
            disabled={mediaPrimeBusy !== null}
            onClick={() => void runPrimeMicrophone()}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
              {mediaPrimeBusy === "mic" ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Mic className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 truncate">Микрофон</span>
            </span>
            <span
              className={cn(
                "shrink-0 whitespace-nowrap text-xs font-medium rounded-full px-2 py-0.5",
                permissionBadgeClass(microphonePermission),
              )}
            >
              {permissionShortLabel(microphonePermission)}
            </span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex h-auto min-h-[var(--uix-touch-min)] w-full min-w-0 justify-between gap-2 whitespace-normal sm:flex-1"
            disabled={mediaPrimeBusy !== null}
            onClick={() => void runPrimeCameraMic()}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
              {mediaPrimeBusy === "cam" ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Video className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 truncate">Камера + микрофон</span>
            </span>
            <span
              className={cn(
                "shrink-0 whitespace-nowrap text-xs font-medium rounded-full px-2 py-0.5",
                cameraMicCombinedClass(microphonePermission, cameraPermission),
              )}
            >
              {cameraMicCombinedLabel(microphonePermission, cameraPermission)}
            </span>
          </Button>
        </div>
      </div>
    </SettingsScreenShell>
  );
}
