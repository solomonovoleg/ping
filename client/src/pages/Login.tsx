import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ForgotPasswordPanel } from "@/features/auth/password-reset/ForgotPasswordPanel";
import { LoginMainFormView } from "@/features/auth/login/LoginMainFormView";
import { useLoginPageController } from "@/features/auth/login/useLoginPageController";

export default function Login() {
  const [, setLocation] = useLocation();
  const { setUserFromLogin } = useAuth();
  const c = useLoginPageController(setLocation, setUserFromLogin);

  return (
    <div className="w-full max-w-full min-w-0 flex flex-col items-center bg-background py-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="w-full max-w-[340px] flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="login-logo-wrap flex flex-col items-center opacity-0">
            <img src="/logo.png?v=3" alt="" className="h-28 w-auto object-contain sm:h-32" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/90 max-w-[260px]">
            Персональный мессенджер! Максимальная приватность
          </p>
        </div>

        {c.showForgotPassword ? (
          <ForgotPasswordPanel
            onBack={() => {
              c.setShowForgotPassword(false);
              c.setError("");
            }}
          />
        ) : null}

        {!c.showForgotPassword ? <LoginMainFormView {...c} /> : null}
      </div>
    </div>
  );
}
