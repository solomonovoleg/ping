import type { ReactNode } from "react";
import { usePulseProfileTheme } from "./pulse-profile-theme";
import { PulseProfilePostCardArticle } from "./layout/PulseProfilePostCardArticle";
import { PulseProfilePostCardHeader } from "./layout/PulseProfilePostCardHeader";

/** Карточка поста в ленте профиля PULSE: шапка с отступами, медиа на всю ширину, подвал с отступами. */
export function PulseProfileThemedPostCard({
  displayName,
  avatarUrl,
  authorSeed,
  showVerified,
  metaKind,
  metaTime,
  headerRight,
  children,
}: {
  displayName: string;
  avatarUrl?: string | null;
  authorSeed: string;
  showVerified?: boolean;
  /** «Видео» / «Фото» — в одной строке с именем после «·». */
  metaKind: string | null;
  /** Время, отдельной строкой под именем. */
  metaTime: string;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  const { th, isDark } = usePulseProfileTheme();
  return (
    <PulseProfilePostCardArticle isDark={isDark} postBg={th.postBg} postBorder={th.postBorder}>
      <PulseProfilePostCardHeader
        displayName={displayName}
        avatarUrl={avatarUrl}
        authorSeed={authorSeed}
        surfaceBg={th.bg}
        insetBorder={th.border}
        showVerified={showVerified}
        metaKind={metaKind}
        metaTime={metaTime}
        textColor={th.text}
        accent={th.accent}
        headerRight={headerRight}
      />
      {children}
    </PulseProfilePostCardArticle>
  );
}
