import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, register } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { checkReferralCode, normalizeReferralCodeInput } from "@/lib/referrals";
import {
  normalizePhoneFromDigits,
  formatPhoneWithPrefix,
  parseInputToDigits,
} from "@/lib/phone";
import { triggerLightHaptic } from "@/lib/capacitor-native";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { FormError } from "@/components/ui/form-error";
import { getPrivacyPolicyUrl } from "@/lib/legal";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { refetch, setUserFromLogin } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [codeHint, setCodeHint] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const hapticLastRef = useRef(0);
  const HAPTIC_THROTTLE_MS = 80;

  // Prefill кода из ссылки ?ref=CODE (работает в браузере и при открытии в приложении по deep link)
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const ref = params.get("ref")?.trim();
    if (ref) {
      const normalized = normalizeReferralCodeInput(ref) || ref;
      setReferralCode(normalized);
      setMode("register");
      checkReferralCode(normalized).then((r) => {
        if (r.valid) setCodeHint(`Приглашение от: ${r.inviterName}`);
        else setCodeHint(null);
      }).catch(() => setCodeHint(null));
    }
  }, []);

  const phoneNormalized = normalizePhoneFromDigits(phoneDigits);
  const phoneError =
    phoneTouched && phoneDigits.length > 0 && !phoneNormalized
      ? "Номер: 10 цифр, начинается с 9 (например 9123456789)"
      : null;

  const handleHaptic = () => {
    const now = Date.now();
    if (now - hapticLastRef.current >= HAPTIC_THROTTLE_MS) {
      hapticLastRef.current = now;
      triggerLightHaptic();
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseInputToDigits(e.target.value);
    setPhoneDigits(next);
    setError("");
    handleHaptic();
  };

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Backspace" || phoneDigits.length === 0) return;
    const input = e.target as HTMLInputElement;
    const val = input.value;
    const selStart = input.selectionStart ?? val.length;
    const selEnd = input.selectionEnd ?? val.length;
    if (selStart !== selEnd) {
      const before = val.slice(0, selStart).replace(/\D/g, "").length;
      const count = val.slice(selStart, selEnd).replace(/\D/g, "").length;
      if (count > 0) {
        const newDigits = phoneDigits.slice(0, before) + phoneDigits.slice(before + count);
        setPhoneDigits(newDigits);
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
      if (mode === "login") {
        const userData = await login(p, pw);
        setUserFromLogin(userData);
        // Отложенный переход, чтобы React успел обновить контекст (важно в iOS WebView)
        setTimeout(() => setLocation("/"), 0);
      } else {
        const userData = await register(p, pw, referralCode);
        setUserFromLogin(userData);
        setTimeout(() => setLocation("/"), 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  const displayPhone = formatPhoneWithPrefix(phoneDigits);

  return (
    <div className="min-h-[100dvh] w-full max-w-full min-w-0 overflow-x-hidden flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-[340px] flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="login-logo-wrap flex flex-col items-center opacity-0">
            <img src="/logo.png?v=3" alt="" className="h-28 w-auto object-contain sm:h-32" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/90 max-w-[260px]">
            Персональный мессенджер! Максимальная приватность
          </p>
        </div>

        {/* iOS-style segmented control */}
        <div className="w-full flex rounded-lg bg-secondary/80 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
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

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Телефон</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              autoCapitalize="off"
              placeholder="9XXXXXXXXX"
              value={displayPhone}
              onChange={handlePhoneChange}
              onKeyDown={handlePhoneKeyDown}
              onBlur={() => setPhoneTouched(true)}
              onFocus={() => triggerLightHaptic()}
              onTouchStart={() => triggerLightHaptic()}
              maxLength={18}
              size="lg"
              className="rounded-lg border-border/80 bg-secondary/30 transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-invalid={!!phoneError}
            />
            {phoneError && (
              <p className="text-sm text-destructive">{phoneError}</p>
            )}
          </div>
          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="referral">Пригласительный код</Label>
              <Input
                id="referral"
                type="text"
                autoComplete="off"
                placeholder="например: дом моды"
                value={referralCode}
                onChange={(e) => {
                  setReferralCode(e.target.value);
                  setError("");
                  handleHaptic();
                }}
                onFocus={() => triggerLightHaptic()}
                onTouchStart={() => triggerLightHaptic()}
                size="lg"
                className="rounded-lg border-border/80 bg-secondary/30 font-mono transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-primary/30"
              />
              {codeHint && (
                <p className="text-xs text-muted-foreground">{codeHint}</p>
              )}
            </div>
          )}
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
                  handleHaptic();
                }}
                onFocus={() => triggerLightHaptic()}
                onTouchStart={() => triggerLightHaptic()}
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
          </div>
          {error && <FormError message={error} />}
          <TapScaleButton
            type="submit"
            haptic
            disabled={
              loading ||
              !phoneNormalized ||
              (mode === "register" && !normalizeReferralCodeInput(referralCode))
            }
            className="w-full min-h-[var(--uix-touch-min)] rounded-lg text-[length:var(--uix-text-input)] font-semibold shadow-none hover:opacity-95 transition-transform duration-75 disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center bg-primary text-primary-foreground"
          >
            {loading ? "..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </TapScaleButton>
          <p className="text-xs text-center text-muted-foreground">
            Мы не передаём ваш номер третьим лицам. Регистрация только по приглашению.{" "}
            <a
              href={getPrivacyPolicyUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Политика конфиденциальности
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
