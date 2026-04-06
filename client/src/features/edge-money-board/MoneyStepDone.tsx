import { TapScaleButton } from "@/components/ui/tap-scale";

type Props = {
  edgeId: string;
  onPublish: () => void;
  publishing: boolean;
  onOpenManage: () => void;
  onCreatePost: () => void;
};

export function MoneyStepDone({ edgeId, onPublish, publishing, onOpenManage, onCreatePost }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 uix-text-caption leading-relaxed text-foreground">
        <p className="font-semibold">Почти готово</p>
        <p className="mt-2 text-muted-foreground">
          Опубликуйте кампанию, затем создайте пост с игрой — иначе подписчики её не увидят.
        </p>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground break-all">edgeId: {edgeId}</p>
      </div>
      <TapScaleButton
        type="button"
        haptic
        className="flex min-h-[var(--uix-touch-min)] w-full items-center justify-center rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground disabled:opacity-60"
        disabled={publishing}
        onClick={onPublish}
      >
        {publishing ? "Публикация…" : "Опубликовать кампанию"}
      </TapScaleButton>
      <TapScaleButton
        type="button"
        haptic
        subtle
        className="flex min-h-[var(--uix-touch-min)] w-full items-center justify-center rounded-2xl border border-border py-3 text-sm font-medium"
        onClick={onCreatePost}
      >
        Создать пост с EDGE
      </TapScaleButton>
      <TapScaleButton
        type="button"
        haptic
        subtle
        className="flex min-h-[var(--uix-touch-min)] w-full items-center justify-center rounded-2xl border border-border py-3 text-sm font-medium text-muted-foreground"
        onClick={onOpenManage}
      >
        К списку кампаний
      </TapScaleButton>
    </div>
  );
}
