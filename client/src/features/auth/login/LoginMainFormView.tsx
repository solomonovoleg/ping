import { useEffect, useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { LegalDocLink } from "@/features/store-moderation/block-02-legal/legal-doc-link";
import { normalizeReferralCodeInput } from "@/lib/referrals";
import { Eye, EyeOff } from "lucide-react";
import type { useLoginPageController } from "./useLoginPageController";
import { LoginRegisterCallVerifyBlock } from "./LoginRegisterCallVerifyBlock";

type C = ReturnType<typeof useLoginPageController>;

function resolveSubmitLabel(params: {
  loading: boolean;
  mode: "login" | "register";
  phoneCallVerificationRequired: boolean | null;
  phoneVerifyTicket: string | null;
}): string {
  if (params.loading) return params.mode === "login" ? "Входим..." : "Обрабатываем...";
  if (params.mode === "login") return "Войти";
  if (params.phoneCallVerificationRequired === null) return "Проверяем условия...";
  return "Зарегистрироваться";
}

export function LoginMainFormView(p: C) {
  const {
    mode,
    setMode,
    displayPhone,
    handlePhoneChange,
    handlePhoneKeyDown,
    phoneError,
    setPhoneTouched,
    referralCode,
    setReferralCode,
    codeHint,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    setShowForgotPassword,
    phoneCallVerificationRequired,
    phoneVerifyChallengeId,
    phoneVerifyConfirmationNumber,
    phoneVerifyQrUri,
    phoneVerifyTicket,
    phoneVerifyExpiresAt,
    error,
    setError,
    loading,
    handleSubmit,
    registeredBase,
    todayGrowth,
    phoneNormalized,
    resetPhoneVerification,
    setLoading,
    setPhoneVerifyChallengeId,
    setPhoneVerifyExpiresAt,
    setPhoneVerifyConfirmationNumber,
    setPhoneVerifyQrUri,
    setPhoneVerifyTicket,
  } = p;
  const submitLabel = resolveSubmitLabel({
    loading,
    mode,
    phoneCallVerificationRequired,
    phoneVerifyTicket,
  });

  const registerBlockedByPhoneVerify =
    mode === "register" &&
    phoneCallVerificationRequired === true &&
    !phoneVerifyTicket;
  const [registerConsentChecked, setRegisterConsentChecked] = useState(false);

  useEffect(() => {
    if (mode === "login") {
      setRegisterConsentChecked(false);
    }
  }, [mode]);

  const registerBlockedByConsent = mode === "register" && !registerConsentChecked;

  const handleFormSubmit = (e: FormEvent) => {
    if (mode === "register" && !registerConsentChecked) {
      e.preventDefault();
      setError("Подтвердите согласие с Условиями использования и Политикой конфиденциальности.");
      return;
    }
    void handleSubmit(e);
  };

  return (
    <>
      <div className="w-full flex rounded-lg bg-secondary/80 p-1">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            resetPhoneVerification();
            setError("");
          }}
          className={`flex-1 py-3 rounded-md text-[15px] font-semibold transition-all duration-75 ease-out active:scale-[0.98] ${
            mode === "login"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground active:opacity-80"
          }`}
        >
          Вход
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("register");
            resetPhoneVerification();
            setError("");
          }}
          className={`flex-1 py-3 rounded-md text-[15px] font-semibold transition-all duration-75 ease-out active:scale-[0.98] ${
            mode === "register"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground active:opacity-80"
          }`}
        >
          Регистрация
        </button>
      </div>

      <form onSubmit={handleFormSubmit} className="w-full space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Телефон</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            autoCapitalize="off"
            placeholder="9XXXXXXXXX"
            value={displayPhone}
            onChange={handlePhoneChange}
            onKeyDown={handlePhoneKeyDown}
            onBlur={() => setPhoneTouched(true)}
            maxLength={18}
            size="lg"
            disabled={
              mode === "register" &&
              phoneCallVerificationRequired === true &&
              !!phoneVerifyChallengeId &&
              !phoneVerifyTicket
            }
            className="rounded-lg border-border/80 bg-secondary/30 transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-invalid={!!phoneError}
          />
          {phoneError && <p className="text-sm text-destructive">{phoneError}</p>}
        </div>
        {mode === "register" ? (
          <LoginRegisterCallVerifyBlock
            referralCode={referralCode}
            codeHint={codeHint}
            setReferralCode={setReferralCode}
            setError={setError}
            phoneCallVerificationRequired={phoneCallVerificationRequired}
            phoneVerifyChallengeId={phoneVerifyChallengeId}
            phoneVerifyConfirmationNumber={phoneVerifyConfirmationNumber}
            phoneVerifyQrUri={phoneVerifyQrUri}
            phoneVerifyTicket={phoneVerifyTicket}
            phoneVerifyExpiresAt={phoneVerifyExpiresAt}
            loading={loading}
            phoneNormalized={phoneNormalized}
            setLoading={setLoading}
            setPhoneVerifyChallengeId={setPhoneVerifyChallengeId}
            setPhoneVerifyExpiresAt={setPhoneVerifyExpiresAt}
            setPhoneVerifyConfirmationNumber={setPhoneVerifyConfirmationNumber}
            setPhoneVerifyQrUri={setPhoneVerifyQrUri}
            setPhoneVerifyTicket={setPhoneVerifyTicket}
          />
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="password">Пароль</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={mode === "register" ? "Не менее 6 символов" : "Пароль"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              size="lg"
              className="rounded-lg border-border/80 bg-secondary/30 transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-primary/30 pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-secondary/80 text-muted-foreground min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {mode === "login" ? (
            <button
              type="button"
              className="text-sm text-primary hover:underline min-h-[var(--uix-touch-min)] px-0 text-left"
              onClick={() => {
                setShowForgotPassword(true);
                setError("");
              }}
            >
              Забыли пароль?
            </button>
          ) : null}
        </div>
        {error && <FormError message={error} />}
        {registerBlockedByPhoneVerify ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Кнопка «Зарегистрироваться» станет доступна после подтверждения номера через New-Tel (см. шаги выше).
          </p>
        ) : null}
        {mode === "register" ? (
          <label className="flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/20 p-2.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={registerConsentChecked}
              onChange={(e) => {
                setRegisterConsentChecked(e.target.checked);
                if (e.target.checked) {
                  setError("");
                }
              }}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
              aria-label="Подтвердить согласие с условиями и политикой"
            />
            <span>
              Я подтверждаю согласие с{" "}
              <LegalDocLink document="terms" className="underline hover:text-foreground">
                Условиями использования
              </LegalDocLink>{" "}
              и{" "}
              <LegalDocLink document="privacy" className="underline hover:text-foreground">
                Политикой конфиденциальности
              </LegalDocLink>
              .
            </span>
          </label>
        ) : null}
        <TapScaleButton
          type="submit"
          haptic
          disabled={
            loading ||
            !phoneNormalized ||
            (mode === "register" && !normalizeReferralCodeInput(referralCode)) ||
            (mode === "register" && phoneCallVerificationRequired === null) ||
            registerBlockedByPhoneVerify ||
            registerBlockedByConsent
          }
          aria-busy={loading}
          aria-live="polite"
          className="w-full min-h-[var(--uix-touch-min)] rounded-lg text-[length:var(--uix-text-input)] font-semibold shadow-none hover:opacity-95 transition-transform duration-75 disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center bg-primary text-primary-foreground"
        >
          {submitLabel}
        </TapScaleButton>
        <p className="text-xs text-center text-muted-foreground">
          Мы не передаём ваш номер третьим лицам. Регистрация только по приглашению. Используя сервис, вы принимаете{" "}
          <LegalDocLink document="terms" className="underline hover:text-foreground">
            Условия использования
          </LegalDocLink>{" "}
          и{" "}
          <LegalDocLink document="privacy" className="underline hover:text-foreground">
            Политику конфиденциальности
          </LegalDocLink>
          .
        </p>
        <p className="text-[11px] text-center text-muted-foreground/80">
          Зарегистрировано {registeredBase} (+{todayGrowth} за сегодня)
        </p>
      </form>
    </>
  );
}
