import { memo } from "react";
import { StatCounter } from "./StatCounter";

type Props = {
  postsCount: number;
  followersCount: number;
  followingCount: number;
  onPostsStatClick?: () => void;
  onFollowersClick: () => void;
  onFollowingClick: () => void;
  nameSep: string;
  statSep: string;
  showAvatarMenu: boolean;
};

export const PulseProfileHeroStatsRow = memo(function PulseProfileHeroStatsRow({
  postsCount,
  followersCount,
  followingCount,
  onPostsStatClick,
  onFollowersClick,
  onFollowingClick,
  nameSep,
  statSep,
  showAvatarMenu,
}: Props) {
  return (
    <div
      style={{
        marginTop: showAvatarMenu ? 6 : 8,
        paddingTop: 7,
        borderTop: `1px solid ${nameSep}`,
      }}
    >
      <div className="flex min-w-0 w-full items-stretch justify-center text-center">
        <div
          className="flex min-w-0 flex-1 justify-center"
          style={{
            borderRight: `1px solid ${statSep}`,
          }}
        >
          <StatCounter target={postsCount} label="Посты" onClick={onPostsStatClick} />
        </div>
        <div
          className="flex min-w-0 flex-1 justify-center"
          style={{
            borderRight: `1px solid ${statSep}`,
          }}
        >
          <StatCounter target={followersCount} label="Подписчики" onClick={onFollowersClick} />
        </div>
        <div className="flex min-w-0 flex-1 justify-center">
          <StatCounter target={followingCount} label="Подписки" onClick={onFollowingClick} />
        </div>
      </div>
    </div>
  );
});
