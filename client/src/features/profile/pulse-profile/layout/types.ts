import type { MouseEvent, PointerEvent, ReactNode, RefObject } from "react";
import type { PulseProfileThemeMode } from "../pulse-profile-theme";

export type PulseProfileTabKey = "posts" | "saved" | "tagged";

export type PulseProfileMutualFollowersModel = {
  count: number;
  preview: Array<{
    id: string;
    publicId: number;
    displayName: string | null;
    surname: string | null;
    avatarUrl: string | null;
  }>;
};

export type PulseProfileLayoutProps = {
  /** Для dev-превью: зафиксировать тёмную/светлую тему независимо от `html.dark`. */
  themeMode?: PulseProfileThemeMode;
  /**
   * `false`: обложка снаружи скролла (оверлей в `PullToRefresh`); pull не двигает обложку.
   * По умолчанию обложка в потоке скролла — тянется вместе со страницей.
   * @default true
   */
  renderCover?: boolean;
  /** Параллакс обложки при `renderCover={false}` и оверлее в `PullToRefresh`. */
  onScrollYChange?: (scrollTop: number) => void;
  scrollRef: RefObject<HTMLDivElement | null>;

  coverUrl: string | null;
  onCoverError: () => void;

  onBack: () => void;
  onMore: () => void;
  usernamePill: string;

  displayName: string;
  showVerified: boolean;
  idChip: string;
  genderChip: string | null;
  birthChip: string | null;
  /** Город в строке мета под именем (необязательно) */
  cityChip?: string | null;

  bio: string | null;
  linkDisplay: string | null;
  linkHref: string | null;

  postsCount: number;
  followersCount: number;
  followingCount: number;
  onFollowersClick: () => void;
  onFollowingClick: () => void;
  onPostsStatClick?: () => void;

  actionRow: ReactNode;

  onHighlightNew?: () => void;
  /** Если задан — вместо заглушки «ЗАКРЕПЛЁННОЕ» из макета. `undefined` — показать старую полосу с шаблоном. */
  pinnedStrip?: ReactNode;

  mutualFollowers?: PulseProfileMutualFollowersModel | null;

  activeTab: PulseProfileTabKey;
  onTabChange: (t: PulseProfileTabKey) => void;
  postView: "list" | "grid";
  onTogglePostView: () => void;

  addContentStrip: ReactNode | null;

  postsContent: ReactNode;

  avatarInner: ReactNode;
  hasStoryGradient: boolean;
  onAvatarPress: () => void;
  onAvatarPointerDown?: (e: PointerEvent<HTMLButtonElement>) => void;
  onAvatarPointerUp?: (e: PointerEvent<HTMLButtonElement>) => void;
  onAvatarPointerLeave?: (e: PointerEvent<HTMLButtonElement>) => void;
  onAvatarPointerCancel?: (e: PointerEvent<HTMLButtonElement>) => void;
  onAvatarContextMenu?: (e: MouseEvent<HTMLButtonElement>) => void;
  showAvatarPlus: boolean;
  onAvatarPlusClick: () => void;
  avatarMenuOpen: boolean;
  onAvatarMenuOpenChange: (open: boolean) => void;
  avatarMenuItems: { label: string; onClick: () => void }[];
};
