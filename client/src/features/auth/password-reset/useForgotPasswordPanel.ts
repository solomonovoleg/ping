import { useCallback, useEffect, useRef, useState } from "react";
import {
  normalizePhoneFromDigits,
  formatPhoneWithPrefix,
  parseInputToDigits,
} from "@/lib/phone";
import { isNative, triggerLightHaptic } from "@/lib/capacitor-native";
import {
  completePasswordReset,
  confirmPasswordResetCall,
  fetchPasswordResetConfig,
  fetchPasswordResetPollStatus,
  startPasswordResetCall,
} from "./password-reset-api";

const PASSWORD_RESET_CALL_POLL_MS = 2500;

export function useForgotPasswordPanel() {
  const native = isNative();
  const [phoneDigits, setPhoneDigits] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [confirmationNumber, setConfirmationNumber] = useState<string | null>(null);
  const [qrCodeUri, setQrCodeUri] = useState<string | null>(null);
  const [resetTicket, setResetTicket] = useState<string | null>(null);
  const [callEnabled, setCallEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [doneHint, setDoneHint] = useState("");

  const confirmInFlightRef = useRef(false);

  const runConfirm = useCallback(async (cid: string, phone: string) => {
    if (confirmInFlightRef.current) return;
    confirmInFlightRef.current = true;
    setLoading(true);
    setError("");
    setHint("");
    try {
      const { resetTicket: t } = await confirmPasswordResetCall(cid, phone, "");
      setResetTicket(t);
      setChallengeId(null);
      setConfirmationNumber(null);
      setQrCodeUri(null);
      setExpiresAt(null);
      setConfirmPassword("");
      setHint("Номер подтверждён. Задайте новый пароль и подтверждение.");
      triggerLightHaptic();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось подтвердить");
    } finally {
      confirmInFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void fetchPasswordResetConfig()
      .then((c) => {
        if (alive) setCallEnabled(c.passwordResetViaCallEnabled);
      })
      .catch(() => {
        if (alive) setCallEnabled(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const phoneNormalized = normalizePhoneFromDigits(phoneDigits);
  const displayPhone = formatPhoneWithPrefix(phoneDigits);
  const phoneError =
    phoneTouched && phoneDigits.length > 0 && !phoneNormalized
      ? "Номер: 10 цифр, начинается с 9 (например 9123456789)"
      : null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneDigits(parseInputToDigits(e.target.value));
    setError("");
  };

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (native) return;
    if (e.key !== "Backspace" || phoneDigits.length === 0) return;
    const input = e.target as HTMLInputElement;
    const val = input.value;
    const selStart = input.selectionStart ?? val.length;
    const selEnd = input.selectionEnd ?? val.length;
    if (selStart !== selEnd) {
      const before = val.slice(0, selStart).replace(/\D/g, "").length;
      const count = val.slice(selStart, selEnd).replace(/\D/g, "").length;
      if (count > 0) {
        setPhoneDigits(phoneDigits.slice(0, before) + phoneDigits.slice(before + count));
        setError("");
        e.preventDefault();
      }
      return;
    }
    if (selStart === val.length) {
      setPhoneDigits(phoneDigits.slice(0, -1));
      setError("");
      e.preventDefault();
    }
  };

  const onRequestCall = async () => {
    triggerLightHaptic();
    setError("");
    setPhoneTouched(true);
    if (!phoneNormalized) {
      setError(phoneDigits.length === 0 ? "Введите номер телефона" : "Номер: 10 цифр, начинается с 9");
      return;
    }
    setLoading(true);
    try {
      const started = await startPasswordResetCall(phoneNormalized);
      if (!started.ok) {
        setHint(started.message);
        setChallengeId(null);
        setExpiresAt(null);
        setConfirmationNumber(null);
        setQrCodeUri(null);
        return;
      }
      setChallengeId(started.challengeId);
      setExpiresAt(started.expiresAt);
      setConfirmationNumber(started.confirmationNumber);
      setQrCodeUri(started.qrCodeUri);
      setHint(
        "Наберите номер сервиса с этого телефона — после звонка шаг сменится сам; при задержке нажмите «Продолжить».",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось начать сброс");
    } finally {
      setLoading(false);
    }
  };

  const onConfirmCall = async () => {
    if (!phoneNormalized || !challengeId) return;
    await runConfirm(challengeId, phoneNormalized);
  };

  useEffect(() => {
    if (!challengeId || !phoneNormalized) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const { verified } = await fetchPasswordResetPollStatus(challengeId, phoneNormalized);
        if (cancelled || !verified) return;
        await runConfirm(challengeId, phoneNormalized);
      } catch {
        /* сеть — следующий интервал */
      }
    };
    void tick();
    const id = window.setInterval(tick, PASSWORD_RESET_CALL_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [challengeId, phoneNormalized, runConfirm]);

  const onSavePassword = async () => {
    if (!phoneNormalized || !resetTicket) return;
    if (newPassword.length < 6) {
      setError("Пароль не менее 6 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await completePasswordReset(phoneNormalized, resetTicket, newPassword);
      setDoneHint("Пароль обновлён. Вернитесь ко входу и войдите с новым паролем.");
      setResetTicket(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить пароль");
    } finally {
      setLoading(false);
    }
  };

  return {
    callEnabled,
    phoneNormalized,
    displayPhone,
    phoneError,
    setPhoneTouched,
    handlePhoneChange,
    handlePhoneKeyDown,
    challengeId,
    expiresAt,
    confirmationNumber,
    qrCodeUri,
    resetTicket,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    error,
    hint,
    loading,
    doneHint,
    onRequestCall,
    onConfirmCall,
    onSavePassword,
  };
}
