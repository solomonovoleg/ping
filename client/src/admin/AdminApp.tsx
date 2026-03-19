import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { fetchMe, login } from "@/lib/auth";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminUsers from "@/pages/admin/Users";
import AdminReferrals from "@/pages/admin/Referrals";
import AdminAdmins from "@/pages/admin/Admins";
import AdminSettings from "@/pages/admin/Settings";
import AdminAudit from "@/pages/admin/Audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ADMIN_ROLES = ["moderator", "admin", "super_admin"];

export function AdminApp() {
  const [location] = useLocation();
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [adminLogin, setAdminLogin] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    fetchMe()
      .then((user) => {
        const ok = !!user && ADMIN_ROLES.includes(user.platformRole ?? "user");
        setAllowed(ok);
        setChecked(true);
      })
      .catch(() => {
        setAllowed(false);
        setChecked(true);
      });
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!adminLogin.trim() || !adminPassword) {
      setLoginError("Введите логин и пароль");
      return;
    }
    setLoginLoading(true);
    try {
      await login(adminLogin.trim(), adminPassword);
      const user = await fetchMe();
      const ok = !!user && ADMIN_ROLES.includes(user.platformRole ?? "user");
      if (ok) setAllowed(true);
      else setLoginError("Этот пользователь не является администратором");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoginLoading(false);
    }
  };

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Загрузка…</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-[320px] rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="text-center text-lg font-semibold text-foreground mb-1">Вход в админ-панель</h1>
          <p className="text-center text-sm text-muted-foreground mb-4">
            Логин <span className="font-mono">admin</span> или номер телефона
          </p>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-login">Логин / Телефон</Label>
              <Input
                id="admin-login"
                type="text"
                placeholder="admin или +79..."
                value={adminLogin}
                onChange={(e) => setAdminLogin(e.target.value)}
                autoComplete="username"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Пароль</Label>
              <Input
                id="admin-password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full"
              />
            </div>
            {loginError && (
              <p className="text-sm text-destructive">{loginError}</p>
            )}
            <Button type="submit" className="w-full" disabled={loginLoading}>
              {loginLoading ? "Вход…" : "Войти"}
            </Button>
          </form>
        </div>
        <a href="/" className="mt-6 text-sm text-muted-foreground hover:text-primary hover:underline">
          Вернуться в приложение
        </a>
      </div>
    );
  }

  const content =
    location === "/admin/users" ? (
      <AdminUsers />
    ) : location === "/admin/referrals" ? (
      <AdminReferrals />
    ) : location === "/admin/admins" ? (
      <AdminAdmins />
    ) : location === "/admin/settings" ? (
      <AdminSettings />
    ) : location === "/admin/audit" ? (
      <AdminAudit />
    ) : (
      <AdminDashboard />
    );

  return <AdminLayout>{content}</AdminLayout>;
}
