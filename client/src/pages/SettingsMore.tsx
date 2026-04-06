import { useState } from "react";
import { Bookmark, ChevronRight, HelpCircle, Mail, Scale, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { TapScaleA, TapScaleButton } from "@/components/ui/tap-scale";
import { LegalDocLink } from "@/features/store-moderation/block-02-legal/legal-doc-link";
import { LegalSettingsNavRow } from "@/features/store-moderation/block-02-legal/legal-settings-nav-row";
import { getSupportEmail } from "@/lib/legal";
import { resolveLegalNavigation } from "@/lib/legal-navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { SettingsScreenShell } from "@/features/settings/components/SettingsScreenShell";

const ADMIN_ROLES = ["moderator", "admin", "super_admin"];

/** Вторая витрина «создатель» внизу настроек. */
const CREATOR_SECOND_CARD = {
  profilePath: "/profile/5",
  title: "Создатель Алексей",
  subtitle: "Профиль участника id5",
  avatarSrc: "/F-PING.png",
  avatarAlt: "Создатель Алексей",
} as const;

export default function SettingsMore() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);

  return (
    <SettingsScreenShell title="Прочее">
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        {ADMIN_ROLES.includes(user?.platformRole ?? "") && (
          <TapScaleButton
            type="button"
            subtle
            onClick={() => setLocation("/admin")}
            className="uix-list-row flex w-full items-center justify-between p-3.5 text-left hover:bg-secondary/50 cursor-pointer transition-colors duration-75 min-h-[var(--uix-touch-min)] rounded-none shadow-none border-0 border-b border-border/50 font-normal"
            aria-label="Админ-панель"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white bg-violet-500">
                <Shield className="w-4 h-4" />
              </div>
              <span className="text-[16px] font-medium">Админ-панель</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
          </TapScaleButton>
        )}
        <TapScaleButton
          type="button"
          subtle
          onClick={() => setLocation("/saved")}
          className="uix-list-row flex w-full items-center justify-between p-3.5 text-left hover:bg-secondary/50 cursor-pointer transition-colors duration-75 min-h-[var(--uix-touch-min)] rounded-none shadow-none border-0 border-b border-border/50 font-normal"
          aria-label="Избранное"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white bg-amber-500">
              <Bookmark className="w-4 h-4" />
            </div>
            <span className="text-[16px] font-medium">Избранное</span>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
        </TapScaleButton>
        <LegalSettingsNavRow
          document="privacy"
          label="Политика конфиденциальности"
          icon={<Shield className="h-4 w-4" aria-hidden />}
          iconClass="bg-slate-500"
        />
        <LegalSettingsNavRow
          document="terms"
          label="Условия использования"
          icon={<Scale className="h-4 w-4" aria-hidden />}
          iconClass="bg-indigo-600"
        />
        <TapScaleA
          href={`mailto:${getSupportEmail()}`}
          className="uix-list-row flex items-center justify-between p-3.5 text-foreground no-underline hover:bg-secondary/50 cursor-pointer transition-colors duration-75 min-h-[var(--uix-touch-min)] border-0 border-b border-border/50 shadow-none"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white bg-teal-500">
              <Mail className="w-4 h-4" />
            </div>
            <span className="text-[16px] font-medium">Поддержка</span>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
        </TapScaleA>
        <TapScaleButton
          type="button"
          subtle
          onClick={() => setHelpDialogOpen(true)}
          className="uix-list-row flex w-full items-center justify-between p-3.5 hover:bg-secondary/50 cursor-pointer transition-colors duration-75 text-left min-h-[var(--uix-touch-min)] rounded-none shadow-none border-0 border-b border-border/50 font-normal"
          aria-label="Помощь"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white bg-teal-500">
              <HelpCircle className="w-4 h-4" />
            </div>
            <span className="text-[16px] font-medium">Помощь</span>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0" />
        </TapScaleButton>
        <TapScaleButton
          type="button"
          subtle
          onClick={() => setAboutDialogOpen(true)}
          className="uix-list-row flex w-full items-center justify-between p-3.5 hover:bg-secondary/50 cursor-pointer transition-colors duration-75 text-left min-h-[var(--uix-touch-min)] rounded-none shadow-none border-0 font-normal"
          aria-label="О приложении"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-muted">
              <span className="text-xs font-semibold text-muted-foreground">i</span>
            </div>
            <span className="text-[16px] font-medium text-foreground">О приложении</span>
          </div>
          <span className="text-sm tabular-nums text-muted-foreground">
            {typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : "—"}
          </span>
        </TapScaleButton>
      </div>

      <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm">
        <TapScaleButton
          type="button"
          subtle
          onClick={() => setLocation("/profile/2")}
          className="w-full flex items-center justify-between gap-3 p-3.5 hover:bg-secondary/50 transition-colors duration-75 rounded-none shadow-none border-0 text-left font-normal border-b border-border/50"
          aria-label="Открыть профиль участника id2"
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/creator-oleg-solomonov.png"
              alt="Создатель Олег Соломнов"
              className="pointer-events-none w-10 h-10 shrink-0 rounded-xl object-contain bg-transparent"
              loading="lazy"
            />
            <div className="min-w-0 text-left">
              <p className="text-sm font-medium text-foreground truncate">Создатель Олег Соломнов</p>
              <p className="text-xs text-muted-foreground truncate">Профиль участника id2</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0" />
        </TapScaleButton>
        <TapScaleButton
          type="button"
          subtle
          onClick={() => setLocation(CREATOR_SECOND_CARD.profilePath)}
          className="w-full flex items-center justify-between gap-3 p-3.5 hover:bg-secondary/50 transition-colors duration-75 rounded-none shadow-none border-0 text-left font-normal"
          aria-label={`Открыть профиль: ${CREATOR_SECOND_CARD.title}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={CREATOR_SECOND_CARD.avatarSrc}
              alt={CREATOR_SECOND_CARD.avatarAlt}
              className="pointer-events-none w-10 h-10 shrink-0 rounded-xl object-contain bg-transparent"
              loading="lazy"
            />
            <div className="min-w-0 text-left">
              <p className="text-sm font-medium text-foreground truncate">{CREATOR_SECOND_CARD.title}</p>
              <p className="text-xs text-muted-foreground truncate">{CREATOR_SECOND_CARD.subtitle}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0" />
        </TapScaleButton>
      </div>

      {user?.publicId === 5 ? (
        <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm">
          <TapScaleButton
            type="button"
            subtle
            onClick={() => setLocation("/profile/me")}
            className="w-full flex items-center justify-between gap-3 p-3.5 hover:bg-secondary/50 transition-colors duration-75 rounded-none shadow-none border-0 text-left font-normal"
            aria-label="Открыть мой профиль, публичный id 5"
          >
            <div className="flex items-center gap-3 min-w-0">
              <UserAvatar
                avatarUrl={user.avatarUrl ?? undefined}
                displayName={[user.displayName, user.surname].filter(Boolean).join(" ") || "Профиль"}
                seed={user.id}
                size={40}
                className="h-10 w-10 shrink-0 rounded-xl"
                pointerEventsNone
              />
              <div className="min-w-0 text-left">
                <p className="text-sm font-medium text-foreground truncate">
                  {[user.displayName, user.surname].filter(Boolean).join(" ") || "Профиль id 5"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  ID {user.publicId}
                  {user.city ? ` · ${user.city}` : ""}
                </p>
                <p className="text-xs text-muted-foreground/90 truncate mt-0.5">
                  {user.bio?.trim() || "я дамб"}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0" />
          </TapScaleButton>
        </div>
      ) : null}

      <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Помощь</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground pt-1">
                <p>
                  <span className="font-medium text-foreground">Уведомления не приходят</span> — проверьте системные
                  разрешения для браузера или приложения и переключатель «Пуш о новых сообщениях» в разделе «Уведомления» в
                  настройках.
                </p>
                <p>
                  <span className="font-medium text-foreground">Нет звука в звонках</span> — в разделе «Камера и микрофон»
                  запросите доступ к микрофону; на телефоне проверьте настройки ОС для приложения.
                </p>
                <p>
                  <span className="font-medium text-foreground">Личные сообщения</span> — кто может написать первым,
                  задаётся в разделе «Приватность».
                </p>
                <p>
                  <span className="font-medium text-foreground">Политика и условия</span> — полный текст:{" "}
                  <LegalDocLink document="privacy" className="text-foreground underline underline-offset-2">
                    конфиденциальность
                  </LegalDocLink>
                  ,{" "}
                  <LegalDocLink document="terms" className="text-foreground underline underline-offset-2">
                    условия
                  </LegalDocLink>
                  ; те же пункты есть в списке ниже («Политика конфиденциальности», «Условия использования»).
                </p>
                <p>Если проблема не решается, напишите в поддержку — приложите скрин и время события.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="button" className="w-full" asChild>
              <a href={`mailto:${getSupportEmail()}`}>Написать в поддержку</a>
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={() => setHelpDialogOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aboutDialogOpen} onOpenChange={setAboutDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>PING</DialogTitle>
            <DialogDescription className="text-left space-y-2">
              <span className="block text-sm text-muted-foreground">
                Мессенджер и лента: чаты, звонки, посты, сториз и профили. Веб и мобильные приложения.
              </span>
              <span className="block text-sm">
                <span className="text-muted-foreground">Сборка:</span>{" "}
                <span className="font-mono tabular-nums">
                  {typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : "—"}
                </span>
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground/80">Часовой пояс (диагностика)</p>
            <p>Зона: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
            <p>
              Смещение: UTC{new Date().getTimezoneOffset() <= 0 ? "+" : ""}
              {-new Date().getTimezoneOffset() / 60}
            </p>
            <p>
              Локальное время: {new Date().getHours().toString().padStart(2, "0")}:
              {new Date().getMinutes().toString().padStart(2, "0")}
            </p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => {
                setAboutDialogOpen(false);
                const nav = resolveLegalNavigation("privacy");
                if (nav.mode === "internal") setLocation(nav.path);
                else window.open(nav.href, "_blank", "noopener,noreferrer");
              }}
            >
              Политика конфиденциальности
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => {
                setAboutDialogOpen(false);
                const nav = resolveLegalNavigation("terms");
                if (nav.mode === "internal") setLocation(nav.path);
                else window.open(nav.href, "_blank", "noopener,noreferrer");
              }}
            >
              Условия использования
            </Button>
            <Button type="button" className="w-full sm:w-auto" onClick={() => setAboutDialogOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsScreenShell>
  );
}
