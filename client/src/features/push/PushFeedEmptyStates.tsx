import { MessageCircle, Sparkles, UserRound } from "lucide-react";
import { ListEmptyState } from "@/components/ui/empty";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { trackPushUix } from "./push-analytics";

type IncomingProps = {
  onOpenPosts?: () => void;
};

/** Пустое состояние входящей Push-ленты: мягкий онбординг без перегруза. */
export function PushFeedEmptyIncoming({ onOpenPosts }: IncomingProps) {
  return (
    <div className="space-y-3">
      <ListEmptyState
        icon={Sparkles}
        title="Push-лента пока пустая"
        description="Микропосты подписанных авторов — здесь, отдельно от чатов."
      />
      <div className="rounded-2xl border border-border/40 bg-muted/15 px-3 py-2.5">
        <p className="text-[11px] font-medium text-foreground/90">Как начать</p>
        <ol className="mt-1.5 space-y-1.5 text-[11px] leading-snug text-muted-foreground">
          <li className="flex gap-2">
            <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400/80" aria-hidden />
            <span>Профиль → «Push-лента» → подписаться.</span>
          </li>
          <li className="flex gap-2">
            <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400/80" aria-hidden />
            <span>Уведомления — если включены в настройках.</span>
          </li>
        </ol>
        {onOpenPosts ? (
          <TapScaleButton
            type="button"
            subtle
            className="mt-2.5 min-h-[var(--uix-touch-min)] w-full rounded-xl border border-border/50 text-[12px] font-medium text-foreground/90"
            onClick={() => {
              trackPushUix("empty_incoming_cta_feed");
              onOpenPosts();
            }}
          >
            Перейти в ленту и профили
          </TapScaleButton>
        ) : null}
      </div>
    </div>
  );
}

type OutgoingProps = {
  onCreatePush?: () => void;
};

export function PushFeedEmptyOutgoing({ onCreatePush }: OutgoingProps) {
  return (
    <div className="space-y-3">
      <ListEmptyState
        icon={Sparkles}
        title="Исходящих Push пока нет"
        description="Короткое сообщение — только подписчикам на ваши Push, не в общую ленту."
      />
      <ul className="rounded-2xl border border-border/35 bg-card/40 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        <li className="flex gap-2 py-0.5">
          <span className="font-medium text-foreground/75">·</span>
          Дневной лимит — в «Новый Push».
        </li>
        <li className="flex gap-2 py-0.5">
          <span className="font-medium text-foreground/75">·</span>
          Обычный пост с лентой — через «Новый пост» (там же опция Push).
        </li>
      </ul>
      {onCreatePush ? (
        <TapScaleButton
          type="button"
          haptic
          className="min-h-[var(--uix-touch-min)] w-full rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-orange-400 px-3 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-rose-500/20"
          onClick={() => {
            trackPushUix("empty_outgoing_cta_create");
            onCreatePush();
          }}
        >
          Создать Push
        </TapScaleButton>
      ) : null}
    </div>
  );
}
