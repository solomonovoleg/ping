import { useState, useEffect, useCallback } from "react";
import { confirmPhoneVerification, login, register } from "@/lib/auth";
import { checkReferralCode, normalizeReferralCodeInput } from "@/lib/referrals";
import {
  normalizePhoneFromDigits,
  formatPhoneWithPrefix,
  parseInputToDigits,
} from "@/lib/phone";
import { isNative, triggerLightHaptic } from "@/lib/capacitor-native";
import { getAuthSocialProof } from "@/lib/auth-social-proof";
import {
  consumePendingAuthReturn,
  hasCompleteProfileForRedirect,
  stashPendingAuthReturnFromWindow,
} from "@/lib/auth-return-path";
import type { AuthUser, PhoneVerificationConfig } from "@/lib/auth";
import { useLoginReferralQueryPrefill } from "./useLoginReferralQueryPrefill";
import { useLoginPhoneCallVerificationGate } from "./useLoginPhoneCallVerificationGate";

type SetLocation = (to: string, opts?: { replace?: boolean }) => void;

export function useLoginPageController(
  setLocation: SetLocation,
  setUserFromLogin: (u: AuthUser & { token?: string }) => void,
) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [codeHint, setCodeHint] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [phoneVerifyChallengeId, setPhoneVerifyChallengeId] = useState<string | null>(null);
  const [phoneVerifyConfirmationNumber, setPhoneVerifyConfirmationNumber] = useState<string | null>(null);
  const [phoneVerifyQrUri, setPhoneVerifyQrUri] = useState<string | null>(null);
  const [phoneVerifyTicket, setPhoneVerifyTicket] = useState<string | null>(null);
  const [phoneVerifyExpiresAt, setPhoneVerifyExpiresAt] = useState<string | null>(null);
  const [registerPhoneVerificationConfig, setRegisterPhoneVerificationConfig] =
    useState<PhoneVerificationConfig | null>(null);
  const [{ registeredBase, todayGrowth }] = useState(() => getAuthSocialProof());
  const native = isNative();

  const phoneCallVerificationRequired: boolean | null =
    mode !== "register"
      ? null
      : registerPhoneVerificationConfig === null
        ? null
        : registerPhoneVerificationConfig.phoneCallVerificationRequired;

  const resetPhoneVerification = useCallback(() => {
    setPhoneVerifyChallengeId(null);
    setPhoneVerifyConfirmationNumber(null);
    setPhoneVerifyQrUri(null);
    setPhoneVerifyTicket(null);
    setPhoneVerifyExpiresAt(null);
  }, []);

  useEffect(() => {
    stashPendingAuthReturnFromWindow();
  }, []);

  useLoginReferralQueryPrefill(setReferralCode, setMode, setCodeHint);
  useLoginPhoneCallVerificationGate(mode, setRegisterPhoneVerificationConfig, resetPhoneVerification);

  useEffect(() => {
    if (registerPhoneVerificationConfig && !registerPhoneVerificationConfig.phoneCallVerificationRequired) {
      resetPhoneVerification();
    }
  }, [registerPhoneVerificationConfig, resetPhoneVerification]);

  const phoneNormalized = normalizePhoneFromDigits(phoneDigits);
  const phoneError =
    phoneTouched && phoneDigits.length > 0 && !phoneNormalized
      ? "Номер: 10 цифр, начинается с 9 (например 9123456789)"
      : null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseInputToDigits(e.target.value);
    if (next !== phoneDigits) resetPhoneVerification();
    setPhoneDigits(next);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerLightHaptic();
    setError("");
    setPhoneTouched(true);

    const p = phoneNormalized;
    const pw = password;

    if (!p) {
      setError(phoneDigits.length === 0 ? "Введите номер телефона" : "Номер: 10 цифр, начинается с 9");
      return;
    }
    if (!pw) {
      setError("Введите пароль");
      return;
    }
    if (mode === "register" && pw.length < 6) {
      setError("Пароль не менее 6 символов");
      return;
    }
    if (mode === "register" && !normalizeReferralCodeInput(referralCode)) {
      setError("Введите пригласительный код. Регистрация только по приглашению.");
      return;
    }

    setLoading(true);
    try {
      stashPendingAuthReturnFromWindow();
      if (mode === "login") {
        const userData = await login(p, pw);
        setUserFromLogin(userData);
        setTimeout(() => {
          if (hasCompleteProfileForRedirect(userData)) {
            setLocation(consumePendingAuthReturn("/"));
          } else {
            setLocation("/");
          }
        }, 0);
      } else {
        if (phoneCallVerificationRequired === null) {
          setError("Проверяем настройки сервера… Повторите через секунду.");
          return;
        }

        const refNorm = normalizeReferralCodeInput(referralCode);
        const refCheck = await checkReferralCode(refNorm);
        if (!refCheck.valid) {
          setError(refCheck.message);
          return;
        }

        if (!phoneCallVerificationRequired) {
          const userData = await register(p, pw, referralCode);
          setUserFromLogin(userData);
          setTimeout(() => {
            if (hasCompleteProfileForRedirect(userData)) {
              setLocation(consumePendingAuthReturn("/posts"));
            } else {
              setLocation("/");
            }
          }, 0);
          return;
        }

        if (!phoneVerifyTicket) {
          setError(
            "Сначала нажмите «Позвонить» (мы передадим в New-Tel ваш номер), наберите показанный номер с этого телефона, затем «Продолжить».",
          );
          return;
        }
        const userData = await register(p, pw, referralCode, phoneVerifyTicket);
        setUserFromLogin(userData);
        setTimeout(() => {
          if (hasCompleteProfileForRedirect(userData)) {
            setLocation(consumePendingAuthReturn("/posts"));
          } else {
            setLocation("/");
          }
        }, 0);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось выполнить действие. Проверьте интернет и попробуйте снова.",
      );
    } finally {
      setLoading(false);
    }
  };

  const displayPhone = formatPhoneWithPrefix(phoneDigits);

  return {
    mode,
    setMode,
    phoneDigits,
    displayPhone,
    handlePhoneChange,
    handlePhoneKeyDown,
    phoneError,
    phoneTouched,
    setPhoneTouched,
    referralCode,
    setReferralCode,
    codeHint,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    showForgotPassword,
    setShowForgotPassword,
    phoneCallVerificationRequired,
    registerPhoneVerificationConfig,
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
  };
}
