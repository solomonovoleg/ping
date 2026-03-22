import { TapScaleButton } from "@/components/ui/tap-scale";
import { cn } from "@/lib/utils";

export type NavPulseCenterLogoButtonProps = {
  isActive: boolean;
  logoSrc: string;
  onShortPress: () => void;
};

/**
 * Центральная кнопка PULSE в нижней навигации: логотип → профиль.
 * Лежит в client/src, чтобы сборка не зависела от внешней папки «ПИНГОК МИКРО».
 */
export function NavPulseCenterLogoButton({ isActive, logoSrc, onShortPress }: NavPulseCenterLogoButtonProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-end min-h-[var(--uix-touch-min)] pt-1 pb-1 gap-1">
      <TapScaleButton
        type="button"
        haptic
        subtle
        onClick={onShortPress}
        className={cn(
          "relative -mt-3 flex shrink-0 items-center justify-center rounded-[14px] p-0",
          "min-h-[48px] min-w-[48px] w-12 h-12",
          "bg-gradient-to-br from-primary to-violet-600",
          "shadow-lg shadow-primary/25 transition-[box-shadow,transform]",
          isActive && "ring-2 ring-primary/55 ring-offset-2 ring-offset-background",
        )}
        aria-label="Мой профиль"
        data-testid="mobile-nav-pulse-logo"
      >
        <img src={logoSrc} alt="" className="h-7 w-7 object-contain pointer-events-none" draggable={false} />
      </TapScaleButton>
    </div>
  );
}
