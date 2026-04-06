import { Button } from "@/components/ui/button";
import { AdminPageHeader, AdminPanelCard, adminPageStackClass } from "@/features/admin-shell";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  SITE_APPLE_WEB_APP_TITLE,
  SITE_DOCUMENT_TITLE,
  SITE_META_DESCRIPTION,
  SITE_OG_IMAGE_PATH,
  SITE_OG_LOCALE,
} from "@/lib/site-seo-defaults";
import { useToast } from "@/hooks/use-toast";
import {
  SITE_REFERRAL_DOCUMENT_TITLE,
  SITE_REFERRAL_META_DESCRIPTION,
} from "@shared/referral-seo-defaults";
import { Copy, Globe, Link2 } from "lucide-react";

const ROWS: { key: string; label: string; value: string; hint?: string }[] = [
  { key: "title", label: "Title (вкладка, og:title, twitter:title)", value: SITE_DOCUMENT_TITLE },
  { key: "description", label: "Meta description (og:description, twitter:description)", value: SITE_META_DESCRIPTION },
  { key: "og_locale", label: "og:locale", value: SITE_OG_LOCALE },
  { key: "apple", label: "apple-mobile-web-app-title", value: SITE_APPLE_WEB_APP_TITLE },
  {
    key: "image",
    label: "og:image / twitter:image (путь)",
    value: SITE_OG_IMAGE_PATH,
    hint: "На Replit при сборке путь может подмениться на абсолютный URL, если есть opengraph.png в public.",
  },
];

const REFERRAL_ROWS: { key: string; label: string; value: string; hint?: string }[] = [
  {
    key: "ref_title",
    label: "Title / og:title / twitter:title (при ?ref=)",
    value: SITE_REFERRAL_DOCUMENT_TITLE,
  },
  {
    key: "ref_desc",
    label: "Meta description / og:description / twitter:description (при ?ref=)",
    value: SITE_REFERRAL_META_DESCRIPTION,
    hint: "Сервер подставляет в HTML при запросе с непустым query ref= (превью в мессенджерах без JS). Картинка превью та же, что у основного сайта.",
  },
];

export default function AdminSeo() {
  const { toast } = useToast();

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text).then(
      () => toast({ title: "Скопировано", description: label }),
      () => toast({ title: "Не удалось скопировать", variant: "destructive" })
    );
  };

  return (
    <div className={cn(adminPageStackClass(), "space-y-6")}>
      <AdminPageHeader
        title="SEO"
        description="Константы title/description для сайта и реферальных ссылок (задаются в коде, подставляются при сборке)."
      />

      <AdminPanelCard className="space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-[hsl(210_20%_98%)]">
            <Globe className="h-4 w-4" />
            Тексты для сайта и превью ссылок
          </h2>
          <p className="mt-1 text-sm admin-text-muted">
            Значения задаются в коде:{" "}
            <code className="rounded bg-[hsl(var(--admin-elevated-strong))] px-1 py-0.5 text-xs">
              client/src/lib/site-seo-defaults.ts
            </code>
            . После правок пересоберите клиент — подстановка в{" "}
            <code className="rounded bg-[hsl(var(--admin-elevated-strong))] px-1 py-0.5 text-xs">index.html</code> идёт через
            Vite при сборке и в dev.
          </p>
        </div>
        <div className="space-y-5">
          {ROWS.map((row) => (
            <div key={row.key} className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <Label className="text-sm font-medium">{row.label}</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 min-h-[var(--uix-touch-min)]"
                  onClick={() => copy(row.value, row.label)}
                >
                  <Copy className="w-4 h-4 mr-1.5" />
                  Копировать
                </Button>
              </div>
              <p className="whitespace-pre-wrap break-words rounded-md border border-[hsl(var(--admin-border)/0.45)] bg-[hsl(var(--admin-elevated)/0.4)] px-3 py-2 font-mono text-sm text-[hsl(210_20%_92%)]">
                {row.value}
              </p>
              {row.hint ? <p className="text-xs admin-text-muted">{row.hint}</p> : null}
            </div>
          ))}
        </div>
      </AdminPanelCard>

      <AdminPanelCard className="space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-[hsl(210_20%_98%)]">
            <Link2 className="h-4 w-4" />
            Реферальные ссылки <code className="text-xs font-normal admin-text-muted">?ref=…</code>
          </h2>
          <p className="mt-1 text-sm admin-text-muted">
            Источник:{" "}
            <code className="rounded bg-[hsl(var(--admin-elevated-strong))] px-1 py-0.5 text-xs">
              shared/referral-seo-defaults.ts
            </code>
            . После правок пересоберите клиент и перезапустите сервер.
          </p>
        </div>
        <div className="space-y-5">
          {REFERRAL_ROWS.map((row) => (
            <div key={row.key} className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <Label className="text-sm font-medium">{row.label}</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 min-h-[var(--uix-touch-min)]"
                  onClick={() => copy(row.value, row.label)}
                >
                  <Copy className="w-4 h-4 mr-1.5" />
                  Копировать
                </Button>
              </div>
              <p className="whitespace-pre-wrap break-words rounded-md border border-[hsl(var(--admin-border)/0.45)] bg-[hsl(var(--admin-elevated)/0.4)] px-3 py-2 font-mono text-sm text-[hsl(210_20%_92%)]">
                {row.value}
              </p>
              {row.hint ? <p className="text-xs admin-text-muted">{row.hint}</p> : null}
            </div>
          ))}
        </div>
      </AdminPanelCard>
    </div>
  );
}
