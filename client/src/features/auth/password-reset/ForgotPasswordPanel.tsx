import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { LegalDocLink } from "@/features/store-moderation/block-02-legal/legal-doc-link";
import { getSupportEmail } from "@/lib/legal";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatServiceDialNumberForDisplay, serviceDialNumberToTelHref } from "@/lib/phone";
import { useForgotPasswordPanel } from "./useForgotPasswordPanel";

type Props = {
  onBack: () => void;
};

export function ForgotPasswordPanel({ onBack }: Props) {
  const fp = useForgotPasswordPanel();
  const isMobile = useIsMobile();

  if (fp.callEnabled === null) {
    return (
      <div className="w-full space-y-4 text-center text-sm text-muted-foreground">
        <p>Загрузка…</p>
        <Button type="button" variant="ghost" onClick={onBack}>
          Назад ко входу
        </Button>
      </div>
    );
  }

  const confirmationDisplay = fp.confirmationNumber
    ? formatServiceDialNumberForDisplay(fp.confirmationNumber)
    : "";
  const resetTelHref = serviceDialNumberToTelHref(fp.confirmationNumber);

  if (!fp.callEnabled) {
    return (
      <div className="w-full space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Сброс пароля по звонку на этом сервере сейчас недоступен. Напишите на{" "}
          <a className="underline text-primary" href={`mailto:${getSupportEmail()}`}>
            {getSupportEmail()}
          </a>
          — укажите номер телефона аккаунта.
        </p>
        <Button type="button" variant="outline" className="w-full min-h-[var(--uix-touch-min)]" onClick={onBack}>
          Назад ко входу
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Восстановление пароля</h2>
        <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onBack}>
          Назад
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fp-phone">Телефон</Label>
        <Input
          id="fp-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="9XXXXXXXXX"
          value={fp.displayPhone}
          onChange={fp.handlePhoneChange}
          onKeyDown={fp.handlePhoneKeyDown}
          onBlur={() => fp.setPhoneTouched(true)}
          maxLength={18}
          size="lg"
          disabled={!!fp.resetTicket || !!fp.challengeId}
          className="rounded-lg border-border/80 bg-secondary/30"
          aria-invalid={!!fp.phoneError}
        />
        {fp.phoneError ? <p className="text-sm text-destructive">{fp.phoneError}</p> : null}
      </div>

      {!fp.challengeId && !fp.resetTicket ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Нажмите <strong>Позвонить</strong> — мы передадим в New-Tel ваш номер. Затем наберите{" "}
            <strong>номер сервиса</strong> из следующего шага; после звонка шаг сменится сам (или нажмите{" "}
            <strong>Продолжить</strong>).
          </p>
          <TapScaleButton
            type="button"
            haptic
            disabled={fp.loading || !fp.phoneNormalized}
            onClick={() => void fp.onRequestCall()}
            className="w-full min-h-[var(--uix-touch-min)] rounded-lg font-semibold bg-primary text-primary-foreground disabled:opacity-50"
          >
            {fp.loading ? "…" : "Позвонить"}
          </TapScaleButton>
        </div>
      ) : null}

      {fp.challengeId && fp.confirmationNumber ? (
        <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/20 p-3">
          <p className="text-sm text-foreground leading-relaxed">
            Мы передали в New-Tel ваш номер. Наберите <strong>номер сервиса</strong> ниже с этого телефона — после
            звонка форма сменится сама; при задержке нажмите «Продолжить».
          </p>
          {resetTelHref ? (
            <a
              href={resetTelHref}
              className="block text-center text-lg font-semibold text-primary underline-offset-2 hover:underline min-h-[var(--uix-touch-min)] flex items-center justify-center"
              aria-label={`Позвонить на ${confirmationDisplay}`}
            >
              {confirmationDisplay}
            </a>
          ) : (
            <p className="text-center text-lg font-semibold">{confirmationDisplay}</p>
          )}
          {!isMobile && fp.qrCodeUri ? (
            <div className="flex flex-col items-center gap-1">
              <img
                src={fp.qrCodeUri}
                alt=""
                className="max-h-40 w-auto rounded-md border border-border/50 bg-background p-1"
              />
              <span className="text-[11px] text-muted-foreground">QR для набора номера</span>
            </div>
          ) : null}
          {fp.expiresAt ? (
            <p className="text-[11px] text-muted-foreground">
              Действует до{" "}
              {new Date(fp.expiresAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 min-h-[var(--uix-touch-min)]"
              disabled={fp.loading}
              onClick={() => void fp.onRequestCall()}
            >
              Другой номер
            </Button>
            <TapScaleButton
              type="button"
              haptic
              className="flex-1 min-h-[var(--uix-touch-min)] rounded-lg font-semibold bg-primary text-primary-foreground"
              disabled={fp.loading}
              onClick={() => void fp.onConfirmCall()}
            >
              Продолжить
            </TapScaleButton>
          </div>
        </div>
      ) : null}

      {fp.resetTicket ? (
        <div className="space-y-2">
          <Label htmlFor="fp-newpw">Новый пароль</Label>
          <Input
            id="fp-newpw"
            type="password"
            autoComplete="new-password"
            placeholder="Не менее 6 символов"
            value={fp.newPassword}
            onChange={(e) => fp.setNewPassword(e.target.value)}
            size="lg"
            className="rounded-lg border-border/80 bg-secondary/30"
          />
          <Label htmlFor="fp-confirmpw">Подтверждение пароля</Label>
          <Input
            id="fp-confirmpw"
            type="password"
            autoComplete="new-password"
            placeholder="Повторите пароль"
            value={fp.confirmPassword}
            onChange={(e) => fp.setConfirmPassword(e.target.value)}
            size="lg"
            className="rounded-lg border-border/80 bg-secondary/30"
          />
          <TapScaleButton
            type="button"
            haptic
            disabled={
              fp.loading ||
              fp.newPassword.length < 6 ||
              fp.confirmPassword.length < 6 ||
              fp.newPassword !== fp.confirmPassword
            }
            onClick={() => void fp.onSavePassword()}
            className="w-full min-h-[var(--uix-touch-min)] rounded-lg font-semibold bg-primary text-primary-foreground disabled:opacity-50"
          >
            {fp.loading ? "…" : "Сохранить пароль"}
          </TapScaleButton>
        </div>
      ) : null}

      {fp.hint ? <p className="text-sm text-muted-foreground leading-relaxed">{fp.hint}</p> : null}
      {fp.error ? <FormError message={fp.error} /> : null}
      {fp.doneHint ? <p className="text-sm text-emerald-600">{fp.doneHint}</p> : null}

      <p className="text-[11px] text-center text-muted-foreground">
        <LegalDocLink document="terms" className="underline">
          Условия
        </LegalDocLink>
        {" · "}
        <LegalDocLink document="privacy" className="underline">
          Конфиденциальность
        </LegalDocLink>
      </p>
    </div>
  );
}
