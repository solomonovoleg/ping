import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { checkReferralCode, normalizeReferralCodeInput } from "@/lib/referrals";
import { confirmPhoneVerification, startPhoneVerification } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatServiceDialNumberForDisplay, serviceDialNumberToTelHref } from "@/lib/phone";

type Props = {
  referralCode: string;
  codeHint: string | null;
  setReferralCode: (v: string) => void;
  setError: (v: string) => void;
  phoneCallVerificationRequired: boolean | null;
  phoneVerifyChallengeId: string | null;
  phoneVerifyConfirmationNumber: string | null;
  phoneVerifyQrUri: string | null;
  phoneVerifyTicket: string | null;
  phoneVerifyExpiresAt: string | null;
  loading: boolean;
  phoneNormalized: string | null;
  setLoading: (v: boolean) => void;
  setPhoneVerifyChallengeId: (v: string | null) => void;
  setPhoneVerifyExpiresAt: (v: string | null) => void;
  setPhoneVerifyConfirmationNumber: (v: string | null) => void;
  setPhoneVerifyQrUri: (v: string | null) => void;
  setPhoneVerifyTicket: (v: string | null) => void;
};

export function LoginRegisterCallVerifyBlock(p: Props) {
  const {
    referralCode,
    codeHint,
    setReferralCode,
    setError,
    phoneCallVerificationRequired,
    phoneVerifyChallengeId,
    phoneVerifyConfirmationNumber,
    phoneVerifyQrUri,
    phoneVerifyTicket,
    phoneVerifyExpiresAt,
    loading,
    phoneNormalized,
    setLoading,
    setPhoneVerifyChallengeId,
    setPhoneVerifyExpiresAt,
    setPhoneVerifyConfirmationNumber,
    setPhoneVerifyQrUri,
    setPhoneVerifyTicket,
  } = p;

  const isMobile = useIsMobile();

  if (phoneCallVerificationRequired !== true) return null;

  const confirmationDisplay = phoneVerifyConfirmationNumber
    ? formatServiceDialNumberForDisplay(phoneVerifyConfirmationNumber)
    : "";
  const telHref = serviceDialNumberToTelHref(phoneVerifyConfirmationNumber);

  const runStart = async () => {
    const ph = phoneNormalized;
    if (!ph) {
      setError("Введите корректный номер телефона");
      return;
    }
    const refNorm = normalizeReferralCodeInput(referralCode);
    if (!refNorm) {
      setError("Введите пригласительный код. Регистрация только по приглашению.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const refCheck = await checkReferralCode(refNorm);
      if (!refCheck.valid) {
        setError(refCheck.message);
        return;
      }
      const started = await startPhoneVerification(ph);
      setPhoneVerifyChallengeId(started.challengeId);
      setPhoneVerifyExpiresAt(started.expiresAt);
      setPhoneVerifyConfirmationNumber(started.confirmationNumber);
      setPhoneVerifyQrUri(started.qrCodeUri);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось начать подтверждение");
    } finally {
      setLoading(false);
    }
  };

  const runContinue = async () => {
    const ph = phoneNormalized;
    if (!ph || !phoneVerifyChallengeId) return;
    setLoading(true);
    setError("");
    try {
      const { verificationTicket } = await confirmPhoneVerification(phoneVerifyChallengeId, ph, "");
      setPhoneVerifyTicket(verificationTicket);
      setPhoneVerifyChallengeId(null);
      setPhoneVerifyConfirmationNumber(null);
      setPhoneVerifyQrUri(null);
      setPhoneVerifyExpiresAt(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось подтвердить. Убедитесь, что уже позвонили на номер ниже, и попробуйте снова.",
      );
    } finally {
      setLoading(false);
    }
  };

  const runAnotherNumber = async () => {
    setPhoneVerifyChallengeId(null);
    setPhoneVerifyConfirmationNumber(null);
    setPhoneVerifyQrUri(null);
    setPhoneVerifyExpiresAt(null);
    await runStart();
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="referral">Пригласительный код</Label>
        <Input
          id="referral"
          type="text"
          autoComplete="off"
          placeholder="(4х значный код)"
          value={referralCode}
          onChange={(e) => {
            setReferralCode(e.target.value);
            setError("");
          }}
          size="lg"
          disabled={!!phoneVerifyChallengeId && !phoneVerifyTicket}
          className="rounded-lg border-border/80 bg-secondary/30 font-mono transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-primary/30"
        />
        {codeHint && <p className="text-xs text-muted-foreground">{codeHint}</p>}
      </div>

      {!phoneVerifyTicket && !phoneVerifyChallengeId ? (
        <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/20 p-3">
          <p className="text-sm text-foreground leading-relaxed">
            Нажмите <strong>Позвонить</strong> — мы передадим в New-Tel номер, с которого вы будете звонить. Затем
            наберите <strong>номер сервиса</strong>, который покажем ниже. После звонка нажмите{" "}
            <strong>Продолжить</strong>.
          </p>
          <TapScaleButton
            type="button"
            haptic
            disabled={loading || !phoneNormalized || !normalizeReferralCodeInput(referralCode)}
            onClick={() => void runStart()}
            className="w-full min-h-[var(--uix-touch-min)] rounded-lg font-semibold bg-primary text-primary-foreground disabled:opacity-50"
          >
            {loading ? "…" : "Позвонить"}
          </TapScaleButton>
        </div>
      ) : null}

      {phoneVerifyChallengeId && phoneVerifyConfirmationNumber && !phoneVerifyTicket ? (
        <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/20 p-3">
          <p className="text-sm font-medium text-foreground">Наберите этот номер с телефона, указанного выше</p>
          {telHref ? (
            <a
              href={telHref}
              className="block text-center text-lg font-semibold tracking-wide text-primary underline-offset-2 hover:underline min-h-[var(--uix-touch-min)] flex items-center justify-center"
              aria-label={`Позвонить на ${confirmationDisplay}`}
            >
              {confirmationDisplay}
            </a>
          ) : (
            <p className="text-center text-lg font-semibold">{confirmationDisplay}</p>
          )}
          {!isMobile && phoneVerifyQrUri ? (
            <div className="flex flex-col items-center gap-1">
              <img
                src={phoneVerifyQrUri}
                alt=""
                className="max-h-40 w-auto rounded-md border border-border/50 bg-background p-1"
              />
              <span className="text-[11px] text-muted-foreground">QR для набора</span>
            </div>
          ) : null}
          {phoneVerifyExpiresAt ? (
            <p className="text-[11px] text-muted-foreground/80">
              Сессия до{" "}
              {new Date(phoneVerifyExpiresAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
            </p>
          ) : null}
          <TapScaleButton
            type="button"
            haptic
            disabled={loading}
            onClick={() => void runContinue()}
            className="w-full min-h-[var(--uix-touch-min)] rounded-lg font-semibold bg-primary text-primary-foreground disabled:opacity-50"
          >
            {loading ? "…" : "Продолжить"}
          </TapScaleButton>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void runAnotherNumber()}
            className="min-h-[var(--uix-touch-min)] w-full"
          >
            Другой номер для звонка
          </Button>
        </div>
      ) : null}

      {phoneVerifyTicket ? (
        <p className="text-xs text-emerald-600">Номер подтверждён в New-Tel. Можно нажать «Зарегистрироваться».</p>
      ) : null}
    </>
  );
}
