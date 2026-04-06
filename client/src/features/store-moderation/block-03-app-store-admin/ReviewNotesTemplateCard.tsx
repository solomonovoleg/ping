import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { AdminPanelCard } from "@/features/admin-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { buildAppStoreReviewNotesTemplate } from "./build-review-notes-template";

export function ReviewNotesTemplateCard() {
  const { toast } = useToast();
  const initial = useMemo(() => buildAppStoreReviewNotesTemplate(), []);
  const [text, setText] = useState(initial);
  const [copied, setCopied] = useState(false);

  const resetToFreshTemplate = () => {
    setText(buildAppStoreReviewNotesTemplate());
    toast({ title: "Шаблон обновлён" });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Скопировано в буфер" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Не удалось скопировать", variant: "destructive" });
    }
  };

  return (
    <AdminPanelCard className="p-5 sm:p-6">
      <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Шаблон Review Notes</h2>
      <p className="mt-1 text-sm admin-text-muted">
        App Store Connect → приложение → версия → App Review Information → Notes. Подставьте тестовый логин и шаги под
        вашу сборку. «Сбросить к актуальному шаблону» заново подставит публичные URL, email и дату текста политики из
        билда.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={resetToFreshTemplate}>
          Сбросить к актуальному шаблону
        </Button>
        <Button type="button" size="sm" onClick={() => void copy()} className="gap-1.5">
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? "Скопировано" : "Копировать"}
        </Button>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="mt-3 min-h-[220px] font-mono text-xs leading-relaxed"
        spellCheck={false}
        aria-label="Текст для App Review Notes"
      />
    </AdminPanelCard>
  );
}
