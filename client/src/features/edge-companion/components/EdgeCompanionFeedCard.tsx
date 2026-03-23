import { EdgeCompanionFeedHero } from "./EdgeCompanionFeedHero";

type EdgeCompanionFeedCardProps = {
  userId: number | string;
  edgeId?: string | null;
  subtitle?: string | null;
  onOpen: () => void;
  className?: string;
  /** `feed` — лента/пост/профиль (анимация входа + polish). `banner` — компактная вставка без entrance. */
  variant?: "feed" | "banner";
};

/**
 * Блок EDGE в теле поста: полноценный превью-макет (призы · персонаж · статы · CTA).
 * `subtitle` зарезервировано для совместимости вызовов; название берётся из campaign-config.
 */
export function EdgeCompanionFeedCard({
  userId,
  edgeId,
  onOpen,
  className,
  variant = "feed",
}: EdgeCompanionFeedCardProps) {
  if (!edgeId?.trim()) return null;
  return (
    <EdgeCompanionFeedHero
      edgeId={edgeId.trim()}
      userId={userId}
      onOpen={onOpen}
      className={className}
      variant={variant}
    />
  );
}
