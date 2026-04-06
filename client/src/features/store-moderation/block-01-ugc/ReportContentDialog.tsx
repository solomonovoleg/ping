import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { LegalDocLink } from "@/features/store-moderation/block-02-legal/legal-doc-link";
import { cn } from "@/lib/utils";
import { block01ugcRu } from "./i18n.ru";
import { REPORT_REASON_PRESETS, buildReportReasonText } from "./report-reason-presets";
import { useContentReportSubmit } from "./use-content-report-submit";
import type { ContentReportReasonCode } from "@shared/schema/content-reports";
import type { Block01ReportTarget } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: Block01ReportTarget | null;
  /** Подзаголовок: контекст для пользователя (пост, профиль…). */
  contextLine?: string;
};

export function ReportContentDialog({ open, onOpenChange, target, contextLine }: Props) {
  const defaultPreset: ContentReportReasonCode = REPORT_REASON_PRESETS[0]?.id ?? "other";
  const [presetId, setPresetId] = useState<ContentReportReasonCode>(defaultPreset);
  const [details, setDetails] = useState("");
  const reasonsScrollRef = useRef<HTMLDivElement | null>(null);
  const mut = useContentReportSubmit(() => onOpenChange(false));

  useEffect(() => {
    if (!open) return;
    setPresetId(defaultPreset);
    setDetails("");
  }, [open, target?.targetId, target?.targetType, target?.contextPostId, target?.contextChatId, defaultPreset]);

  /** Не даём фокусу на поле деталей прокрутить список причин вниз — иначе выбранный по умолчанию пункт остается вне экрана и кажется, что категория не выбрана. */
  useLayoutEffect(() => {
    if (!open) return;
    reasonsScrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [open, target?.targetId, target?.targetType, target?.contextPostId, target?.contextChatId]);

  const otherNeedsDetails = presetId === "other" && details.trim().length < 3;
  const submit = () => {
    if (!target || otherNeedsDetails) return;
    const reason = buildReportReasonText(presetId, details);
    mut.mutate({ ...target, reasonCode: presetId, reason });
  };

  const handleDetailsKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mut.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        overlayClassName="z-[1090] bg-black/72"
        className="uix-responsive-max-w z-[1100] flex max-h-[92dvh] flex-col gap-4 overflow-hidden sm:max-w-lg sm:rounded-2xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const first = REPORT_REASON_PRESETS[0]?.id;
          if (!first) return;
          queueMicrotask(() => document.getElementById(`report-reason-${first}`)?.focus());
        }}
      >
        <DialogHeader>
          <DialogTitle>{block01ugcRu.dialogTitle}</DialogTitle>
          <DialogDescription>{block01ugcRu.dialogDescription}</DialogDescription>
          {contextLine ? (
            <p className="text-sm text-muted-foreground leading-snug pt-1">{contextLine}</p>
          ) : null}
        </DialogHeader>

        <div ref={reasonsScrollRef} className="min-h-0 space-y-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label id="report-reason-heading" className="text-sm font-medium">
              {block01ugcRu.reasonLabel}
            </Label>
            <RadioGroup
              value={presetId}
              onValueChange={(v) => setPresetId(v as ContentReportReasonCode)}
              aria-labelledby="report-reason-heading"
              className="flex flex-col gap-1.5"
              disabled={mut.isPending}
            >
              {REPORT_REASON_PRESETS.map((p) => {
                const itemId = `report-reason-${p.id}`;
                const selected = presetId === p.id;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex min-h-[var(--uix-touch-min)] items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/80 bg-secondary/30 hover:bg-secondary/50",
                    )}
                  >
                    <RadioGroupItem value={p.id} id={itemId} className="shrink-0" />
                    <Label htmlFor={itemId} className="flex-1 cursor-pointer text-left text-sm font-normal leading-snug">
                      {p.label}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-details">
              {presetId === "other" ? block01ugcRu.detailsRequiredWhenOther : block01ugcRu.detailsPlaceholder}
            </Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              onKeyDown={handleDetailsKeyDown}
              placeholder={block01ugcRu.detailsPlaceholder}
              rows={3}
              className="resize-none"
              aria-invalid={otherNeedsDetails}
            />
            {otherNeedsDetails ? (
              <p className="text-xs text-destructive">{block01ugcRu.detailsRequiredWhenOther}</p>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">{block01ugcRu.moderationNote}</p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {block01ugcRu.legalLinksIntro}{" "}
            <LegalDocLink document="terms" className="underline underline-offset-2">
              Условия
            </LegalDocLink>
            {" · "}
            <LegalDocLink document="privacy" className="underline underline-offset-2">
              Конфиденциальность
            </LegalDocLink>
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">{block01ugcRu.blockHint}</p>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/70 pt-3 sm:gap-0 sm:pt-4">
          <p className="hidden w-full text-xs text-muted-foreground sm:mr-auto sm:block sm:w-auto">
            Ctrl/Cmd + Enter - отправить
          </p>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            {block01ugcRu.cancel}
          </Button>
          <TapScaleButton
            type="button"
            haptic
            onClick={submit}
            disabled={!target || mut.isPending || otherNeedsDetails}
            className={cn(buttonVariants())}
          >
            {mut.isPending ? block01ugcRu.submitting : block01ugcRu.submit}
          </TapScaleButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
