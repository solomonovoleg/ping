import { memo, type ReactNode } from "react";

type Props = {
  isDark: boolean;
  postBg: string;
  postBorder: string;
  children: ReactNode;
};

export const PulseProfilePostCardArticle = memo(function PulseProfilePostCardArticle({
  isDark,
  postBg,
  postBorder,
  children,
}: Props) {
  return (
    <article
      className="relative w-full overflow-hidden"
      style={{
        background: postBg,
        borderBottom: `1px solid ${postBorder}`,
        boxShadow: isDark ? "0 1px 0 rgba(0,0,0,0.2)" : undefined,
      }}
    >
      {children}
    </article>
  );
});
