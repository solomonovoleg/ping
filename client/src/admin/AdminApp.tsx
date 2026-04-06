import { useState, useEffect, type ReactElement } from "react";
import { useLocation } from "wouter";
import { fetchMe, type AuthUser } from "@/lib/auth";
import { adminLogin as requestAdminLogin } from "@/admin/api";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminUsers from "@/pages/admin/Users";
import AdminReferrals from "@/pages/admin/Referrals";
import AdminAdmins from "@/pages/admin/Admins";
import AdminSettings from "@/pages/admin/Settings";
import AdminVkParser from "@/pages/admin/VkParser";
import AdminAudit from "@/pages/admin/Audit";
import AdminOps from "@/pages/admin/Ops";
import AdminMonitors from "@/pages/admin/Monitors";
import AdminNewTelCallPasswordLog from "@/pages/admin/NewTelCallPasswordLog";
import AdminDisk from "@/pages/admin/Disk";
import AdminServiceChat from "@/pages/admin/ServiceChat";
import AdminEdgeCompanion from "@/pages/admin/EdgeCompanion";
import AdminHelpPages from "@/pages/admin/HelpPages";
import AdminSeo from "@/pages/admin/Seo";
import AdminMediaStudio from "@/pages/admin/MediaStudio";
import AdminGroupChats from "@/pages/admin/GroupChats";
import AdminStoreReview from "@/pages/admin/StoreReview";
import AdminStorePrivacyCompliance from "@/pages/admin/StorePrivacyCompliance";
import AdminStoreMetadataCompliance from "@/pages/admin/StoreMetadataCompliance";
import AdminStoreReviewRisks from "@/pages/admin/StoreReviewRisks";
import AdminStorePlayCompliance from "@/pages/admin/StorePlayCompliance";
import AdminModeration from "@/pages/admin/Moderation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ADMIN_ROLES = ["moderator", "admin", "super_admin"];
const PRIVILEGED_ADMIN_ROLES = ["admin", "super_admin"] as const;
const LAST_ADMIN_PATH_KEY = "ping:admin:last-path";

type AdminPageResolverContext = {
  me: AuthUser | null;
};

type AdminPageResolver = (ctx: AdminPageResolverContext) => ReactElement;

const ADMIN_ROUTE_RESOLVERS: Record<string, AdminPageResolver> = {
  "/admin/users": () => <AdminUsers />,
  "/admin/referrals": () => <AdminReferrals />,
  "/admin/admins": () => <AdminAdmins />,
  "/admin/settings": () => <AdminSettings />,
  "/admin/vk-parser": () => <AdminVkParser />,
  "/admin/audit": () => <AdminAudit />,
  "/admin/ops": () => <AdminOps />,
  "/admin/monitors": () => <AdminMonitors />,
  "/admin/new-tel-calls": () => <AdminNewTelCallPasswordLog />,
  "/admin/disk": () => <AdminDisk />,
  "/admin/service-chat": () => <AdminServiceChat />,
  "/admin/edge-companion": () => <AdminEdgeCompanion />,
  "/admin/help-pages": () => <AdminHelpPages />,
  "/admin/seo": () => <AdminSeo />,
  "/admin/moderation": () => <AdminModeration />,
  "/admin/store-review": () => <AdminStoreReview />,
  "/admin/store-review-privacy": () => <AdminStorePrivacyCompliance />,
  "/admin/store-review-metadata": () => <AdminStoreMetadataCompliance />,
  "/admin/store-review-risks": () => <AdminStoreReviewRisks />,
  "/admin/store-review-play": () => <AdminStorePlayCompliance />,
  "/admin/group-chats": () => <AdminGroupChats />,
};

function canAccessMediaStudio(user: AuthUser | null): boolean {
  return !!user && PRIVILEGED_ADMIN_ROLES.includes((user.platformRole ?? "user") as (typeof PRIVILEGED_ADMIN_ROLES)[number]);
}

function resolveAdminRouteContent(location: string, ctx: AdminPageResolverContext): ReactElement {
  if (location === "/admin/media-studio") {
    if (canAccessMediaStudio(ctx.me)) return <AdminMediaStudio />;
    return (
      <div className="rounded-xl border border-border/60 bg-card p-8 text-center text-muted-foreground">
        Раздел доступен только ролям <span className="font-mono text-foreground">admin</span> и{" "}
        <span className="font-mono text-foreground">super_admin</span>.
      </div>
    );
  }
  const resolver = ADMIN_ROUTE_RESOLVERS[location];
  return resolver ? resolver(ctx) : <AdminDashboard />;
}

export function AdminApp() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    root.setAttribute("data-admin-full-width", "1");
    return () => root.removeAttribute("data-admin-full-width");
  }, []);

  useEffect(() => {
    if (!location.startsWith("/admin")) return;
    if (location === "/admin") return;
    try {
      localStorage.setItem(LAST_ADMIN_PATH_KEY, location);
    } catch {
      /* ignore */
    }
  }, [location]);

  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [me, setMe] = useState<AuthUser | null>(null);
  const [adminLogin, setAdminLogin] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    fetchMe()
      .then((user) => {
        setMe(user ?? null);
        const ok = !!user && ADMIN_ROLES.includes(user.platformRole ?? "user");
        setAllowed(ok);
        setChecked(true);
      })
      .catch(() => {
        setMe(null);
        setAllowed(false);
        setChecked(true);
      });
  }, []);

  useEffect(() => {
    if (!checked || !allowed) return;
    if (location !== "/admin") return;
    try {
      const saved = localStorage.getItem(LAST_ADMIN_PATH_KEY);
      if (saved && saved.startsWith("/admin/")) {
        setLocation(saved, { replace: true } as { replace?: boolean });
      }
    } catch {
      /* ignore */
    }
  }, [allowed, checked, location, setLocation]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!adminLogin.trim() || !adminPassword) {
      setLoginError("Введите логин и пароль");
      return;
    }
    setLoginLoading(true);
    try {
      await requestAdminLogin(adminLogin.trim(), adminPassword);
      const user = await fetchMe();
      setMe(user ?? null);
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

  const content = resolveAdminRouteContent(location, { me });
  const showMediaStudioNav = canAccessMediaStudio(me);

  return (
    <AdminLayout showMediaStudioNav={showMediaStudioNav} user={me}>
      {content}
    </AdminLayout>
  );
}
