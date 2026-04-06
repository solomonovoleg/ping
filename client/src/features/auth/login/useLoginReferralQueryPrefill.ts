import { useEffect } from "react";
import { checkReferralCode, normalizeReferralCodeInput } from "@/lib/referrals";
import {
  restoreDefaultSitePageMeta,
  setReferralInvitePageMeta,
} from "@/lib/referral-page-meta";

export function useLoginReferralQueryPrefill(
  setReferralCode: (v: string) => void,
  setMode: (m: "login" | "register") => void,
  setCodeHint: (v: string | null) => void,
) {
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const ref = params.get("ref")?.trim();
    if (ref) {
      setReferralInvitePageMeta();
      const normalized = normalizeReferralCodeInput(ref) || ref;
      setReferralCode(normalized);
      setMode("register");
      checkReferralCode(normalized)
        .then((r) => {
          if (r.valid) setCodeHint(`Приглашение от: ${r.inviterName}`);
          else setCodeHint(null);
        })
        .catch(() => setCodeHint(null));
      return () => restoreDefaultSitePageMeta();
    }
    // читаем ?ref= один раз при монтировании
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
