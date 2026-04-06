import { ExternalLink, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { adminOpsUi } from "./i18n.ru";
import { reportTargetAppPath, reportTargetOpenHint } from "./report-target-app-links";

function formatReportTargetType(t: string): string {
  switch (t) {
    case "post":
      return "Пост";
    case "user":
      return "Пользователь";
    case "message":
      return "Сообщение";
    case "story":
      return "Сториз";
    case "comment":
      return "Комментарий";
    default:
      return t;
  }
}

export function OpsReportTargetCell({
  targetType,
  targetId,
  contextPostId = null,
  contextChatId = null,
}: {
  targetType: string;
  targetId: string;
  contextPostId?: string | null;
  contextChatId?: string | null;
}) {
  const { toast } = useToast();
  const ctx = { contextPostId, contextChatId };
  const path = reportTargetAppPath(targetType, targetId, ctx);
  const hint = reportTargetOpenHint(targetType, ctx);
  const fullUrl =
    typeof window !== "undefined" && path ? `${window.location.origin}${path}` : path ? path : null;

  const copyId = () => {
    void navigator.clipboard?.writeText(targetId).then(
      () => toast({ title: "ID скопирован" }),
      () => toast({ title: "Не удалось скопировать", variant: "destructive" }),
    );
  };

  const copyAppLink = () => {
    const text = fullUrl ?? "";
    if (!text.trim()) return;
    void navigator.clipboard?.writeText(text).then(
      () => toast({ title: adminOpsUi.targetAppLinkCopied }),
      () => toast({ title: adminOpsUi.targetAppLinkCopyFailed, variant: "destructive" }),
    );
  };

  return (
    <div className="space-y-1.5 text-sm">
      <div className="font-mono text-[13px]">
        <span className="text-muted-foreground">{formatReportTargetType(targetType)} · </span>
        <span title={targetId}>
          {targetId.slice(0, 24)}
          {targetId.length > 24 ? "…" : ""}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {fullUrl ? (
          <>
            <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
              <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Открыть в приложении: ${formatReportTargetType(targetType)}`}
              >
                В приложении
                <ExternalLink className="h-3 w-3 opacity-80" aria-hidden />
              </a>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={copyAppLink}
              aria-label="Скопировать полную ссылку для открытия в приложении"
            >
              <Link2 className="h-3 w-3 opacity-80" aria-hidden />
              Ссылка
            </Button>
          </>
        ) : null}
        <Button type="button" variant="secondary" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={copyId}>
          <Copy className="h-3 w-3 opacity-80" aria-hidden />
          ID
        </Button>
      </div>
      {hint ? <p className="text-[11px] leading-snug text-muted-foreground max-w-[220px]">{hint}</p> : null}
    </div>
  );
}
