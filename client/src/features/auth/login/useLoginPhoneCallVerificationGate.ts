import { useCallback, useEffect } from "react";
import { fetchPhoneVerificationConfig, type PhoneVerificationConfig } from "@/lib/auth";

async function loadPhoneVerificationConfigWithRetries(): Promise<PhoneVerificationConfig> {
  const delaysMs = [0, 400, 1200];
  let lastErr: unknown;
  for (let i = 0; i < delaysMs.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, delaysMs[i]));
    try {
      return await fetchPhoneVerificationConfig();
    } catch (e) {
      lastErr = e;
    }
  }
  if (typeof console !== "undefined" && console.warn) {
    console.warn(
      "[auth] phone-verification config: failed after retries, assuming no call step (server still validates /register)",
      lastErr,
    );
  }
  /* Не форсируем звонок: при ошибке сети это давало ложное «нужен звонок» при выключенной админке. */
  return {
    phoneCallVerificationRequired: false,
    registrationPhoneCallVerificationEnabled: false,
    forcedByEnv: false,
  };
}

export function useLoginPhoneCallVerificationGate(
  mode: "login" | "register",
  setRegisterPhoneVerificationConfig: (c: PhoneVerificationConfig | null) => void,
  resetPhoneVerification: () => void,
) {
  const refreshRegisterConfig = useCallback(() => loadPhoneVerificationConfigWithRetries(), []);

  useEffect(() => {
    if (mode !== "register") {
      setRegisterPhoneVerificationConfig(null);
      return;
    }
    let alive = true;
    setRegisterPhoneVerificationConfig(null);
    void refreshRegisterConfig().then((c) => {
      if (alive) setRegisterPhoneVerificationConfig(c);
    });
    return () => {
      alive = false;
    };
  }, [mode, setRegisterPhoneVerificationConfig, refreshRegisterConfig]);

  useEffect(() => {
    if (mode !== "register") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refreshRegisterConfig().then((c) => {
        setRegisterPhoneVerificationConfig(c);
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [mode, refreshRegisterConfig, setRegisterPhoneVerificationConfig]);
}
