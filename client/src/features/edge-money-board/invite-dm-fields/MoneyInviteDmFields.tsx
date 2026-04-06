import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MoneyHintBlock } from "../MoneyHintBlock";

type Props = {
  template: string;
  codeExpiresInHours: number;
  onTemplate: (v: string) => void;
  onCodeExpiresInHours: (v: number) => void;
};

export function MoneyInviteDmFields({ template, codeExpiresInHours, onTemplate, onCodeExpiresInHours }: Props) {
  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-3 shadow-xs">
      <p className="text-sm font-semibold text-foreground">ЛС с кодами приглашения</p>
      <p className="mt-1 uix-text-caption leading-snug text-muted-foreground">
        Когда участник нажимает «Получить коды», ему в личку от вас уходит сообщение. Пустой шаблон — стандартный
        текст платформы.
      </p>
      <div className="mt-3 space-y-3">
        <div>
          <Label htmlFor="money-invite-dm-template">Текст сообщения</Label>
          <Textarea
            id="money-invite-dm-template"
            className="mt-1.5 min-h-[120px] font-mono text-xs"
            value={template}
            onChange={(e) => onTemplate(e.target.value)}
            placeholder="Оставьте пустым для текста по умолчанию…"
            maxLength={8000}
          />
        </div>
        <div>
          <Label htmlFor="money-invite-dm-hours">Срок действия каждого кода, часы (1–720)</Label>
          <Input
            id="money-invite-dm-hours"
            type="number"
            min={1}
            max={720}
            className="mt-1.5"
            value={codeExpiresInHours}
            onChange={(e) => onCodeExpiresInHours(Number(e.target.value) || 168)}
          />
        </div>
        <MoneyHintBlock label="Плейсхолдеры">
          <p>
            <code className="rounded bg-muted px-1">{"{{codes}}"}</code> — список кодов,{" "}
            <code className="rounded bg-muted px-1">{"{{count}}"}</code> — сколько штук,{" "}
            <code className="rounded bg-muted px-1">{"{{appLink}}"}</code> — ссылка из{" "}
            <code className="rounded bg-muted px-1">PING_INVITE_APP_URL</code>.
          </p>
        </MoneyHintBlock>
      </div>
    </div>
  );
}
