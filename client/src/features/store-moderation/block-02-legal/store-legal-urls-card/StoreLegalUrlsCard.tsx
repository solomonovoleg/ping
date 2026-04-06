import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { AdminPanelCard } from "@/features/admin-shell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getPrivacyPolicyUrl, getSupportEmail, getTermsOfUseUrl } from "@/lib/legal";
import { LEGAL_DOCUMENTS_UPDATED_RU } from "../legal-version";

type RowProps = { label: string; value: string; mono?: boolean };

function CopyRow({ label, value, mono = true }: RowProps) {
  const { toast } = useToast();
  const [ok, setOk] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setOk(true);
      toast({ title: "Скопировано", description: label, duration: 2000 });
      window.setTimeout(() => setOk(false), 2000);
    } catch {
      toast({ title: "Не удалось скопировать", variant: "destructive" });
    }
  };

  return (
    <div className="rounded-lg border border-[hsl(var(--admin-border)/0.35)] bg-[hsl(var(--admin-elevated)/0.2)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[hsl(210_20%_98%/0.75)]">{label}</p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 gap-1.5 shrink-0"
          aria-label={`Копировать в буфер: ${label}`}
          onClick={() => void copy()}
        >
          {ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {ok ? "Готово" : "Копировать"}
        </Button>
      </div>
      <p className={mono ? "mt-2 break-all font-mono text-xs leading-relaxed text-[hsl(210_20%_98%/0.9)]" : "mt-2 text-sm text-[hsl(210_20%_98%/0.9)]"}>
        {value}
      </p>
    </div>
  );
}

function buildStoreLegalUrlsBlock(privacy: string, terms: string, support: string): string {
  return [
    "PING — юридические ссылки для App Store Connect / Google Play",
    `(текст документов обновлён: ${LEGAL_DOCUMENTS_UPDATED_RU})`,
    "",
    `Privacy Policy URL:\n${privacy}`,
    "",
    `Terms of use URL:\n${terms}`,
    "",
    `Support email:\n${support}`,
  ].join("\n");
}

export function StoreLegalUrlsCard() {
  const { toast } = useToast();
  const [bundleCopied, setBundleCopied] = useState(false);
  const privacy = getPrivacyPolicyUrl();
  const terms = getTermsOfUseUrl();
  const support = getSupportEmail();

  const copyBundle = async () => {
    try {
      await navigator.clipboard.writeText(buildStoreLegalUrlsBlock(privacy, terms, support));
      setBundleCopied(true);
      toast({ title: "Блок скопирован", description: "Вставьте в заметки или в документ для стора.", duration: 2500 });
      window.setTimeout(() => setBundleCopied(false), 2000);
    } catch {
      toast({ title: "Не удалось скопировать", variant: "destructive" });
    }
  };

  return (
    <AdminPanelCard className="p-5 sm:p-6">
      <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Публичные ссылки (как в приложении)</h2>
      <p className="mt-1 text-sm admin-text-muted">
        Сверьте с полями в Connect / Play Console. Если хост совпадает с приложением, внутри клиента открываются маршруты{" "}
        <span className="font-mono text-[hsl(210_20%_98%/0.85)]">/privacy</span> и{" "}
        <span className="font-mono text-[hsl(210_20%_98%/0.85)]">/terms</span> без внешнего браузера. Текст документов
        обновлён: <span className="text-[hsl(210_20%_98%/0.9)]">{LEGAL_DOCUMENTS_UPDATED_RU}</span>.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="default"
          className="gap-1.5"
          aria-label="Скопировать все юридические ссылки и email одним блоком"
          onClick={() => void copyBundle()}
        >
          {bundleCopied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {bundleCopied ? "Скопировано" : "Копировать всё для стора"}
        </Button>
      </div>
      <div className="mt-4 space-y-3">
        <CopyRow label="Privacy Policy URL" value={privacy} />
        <CopyRow label="Terms of use URL" value={terms} />
        <CopyRow label="Support email" value={support} mono={false} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
          <a href={privacy} target="_blank" rel="noopener noreferrer">
            Открыть политику
            <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
          </a>
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
          <a href={terms} target="_blank" rel="noopener noreferrer">
            Открыть условия
            <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
          </a>
        </Button>
      </div>
    </AdminPanelCard>
  );
}
