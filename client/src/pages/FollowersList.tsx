/**
 * Список подписчиков или подписок пользователя.
 * Маршрут: /profile/:id/followers | /profile/:id/following
 */
import { useState } from "react";
import { ChevronLeft, Search, UserPlus, Check, Users } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ListEmptyState } from "@/components/ui/empty";
import { TapScaleButton, TapScaleDiv } from "@/components/ui/tap-scale";
import { buildProfilePath } from "@/lib/profile-route";
import { fetchUserProfile, fetchFollowers, fetchFollowing, followUser, unfollowUser, type FollowUser } from "@/lib/users";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { useToast } from "@/hooks/use-toast";

type Mode = "followers" | "following";

export default function FollowersList() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({});

  const id = (params?.id ?? "").trim().replace(/^@+/, "");
  const isMe = id === "me" || id === "";
  const targetUserId = isMe ? (user?.id ?? "") : "";

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", id],
    queryFn: () => fetchUserProfile(id),
    enabled: !isMe && !!id,
  });

  const resolvedUserId = isMe ? targetUserId : profile?.id ?? "";

  const { data: followers = [], isLoading: followersLoading } = useQuery({
    queryKey: ["followers", resolvedUserId],
    queryFn: () => fetchFollowers(resolvedUserId, 100),
    enabled: !!resolvedUserId,
  });

  const { data: following = [], isLoading: followingLoading } = useQuery({
    queryKey: ["following", resolvedUserId],
    queryFn: () => fetchFollowing(resolvedUserId, 100),
    enabled: !!resolvedUserId,
  });

  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const mode: Mode = pathname.includes("/following") ? "following" : "followers";
  const list = mode === "followers" ? followers : following;
  const isLoading = profileLoading || (mode === "followers" ? followersLoading : followingLoading);

  const filtered = list.filter(
    (u) =>
      (u.displayName ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.surname ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(u.publicId).includes(searchQuery)
  );

  const handleToggleFollow = async (targetId: string, currentlyFollowing: boolean) => {
    setFollowLoading((prev) => ({ ...prev, [targetId]: true }));
    try {
      if (currentlyFollowing) {
        await unfollowUser(targetId);
        toast({ title: "Отписка выполнена" });
      } else {
        await followUser(targetId);
        toast({ title: "Вы подписались" });
      }
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    } finally {
      setFollowLoading((prev) => ({ ...prev, [targetId]: false }));
    }
  };

  const title = mode === "followers" ? "Подписчики" : "Подписки";
  const backPath = isMe ? "/profile/me" : (id ? `/profile/${encodeURIComponent(id)}` : "/posts");
  const emptyDescription = searchQuery
    ? "Измените поиск"
    : mode === "followers"
      ? "Подписчиков пока нет"
      : "Вы пока ни на кого не подписаны";

  return (
    <div className="flex h-full w-full max-w-full min-w-0 overflow-x-hidden justify-center bg-background">
      <div className="w-full h-full max-w-[480px] min-w-0 flex flex-col bg-background relative shadow-2xl overflow-hidden">
        <div className="uix-content-x py-4 glass z-10 sticky top-0 relative flex items-center justify-between">
          <TapScaleButton
            type="button"
            onClick={() => setLocation(backPath)}
            haptic
            subtle
            className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Назад"
          >
            <ChevronLeft className="w-6 h-6" />
          </TapScaleButton>
          <h1 className="flex-1 text-center uix-text-title">{title}</h1>
          <div className="w-10" />
        </div>

        <div className="uix-content-x py-2 border-b border-border/50">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Поиск"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-secondary text-foreground rounded-xl py-2 pl-10 pr-4 outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 hide-scrollbar">
          <div className="p-2">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length > 0 ? (
              filtered.map((u) => (
                <FollowerRow
                  key={u.id}
                  user={u}
                  currentUserId={user?.id}
                  mode={mode}
                  onProfileClick={() =>
                    setLocation(
                      buildProfilePath({
                        publicId: u.publicId,
                        userId: u.id,
                        fallbackPath: "/posts",
                      })
                    )
                  }
                  onToggleFollow={handleToggleFollow}
                  followLoading={followLoading[u.id]}
                />
              ))
            ) : (
              <ListEmptyState
                icon={Users}
                title={searchQuery ? "Никого не найдено" : mode === "followers" ? "Нет подписчиков" : "Нет подписок"}
                description={emptyDescription}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FollowerRow({
  user,
  currentUserId,
  mode,
  onProfileClick,
  onToggleFollow,
  followLoading,
}: {
  user: FollowUser;
  currentUserId?: string;
  mode: Mode;
  onProfileClick: () => void;
  onToggleFollow: (id: string, currentlyFollowing: boolean) => void;
  followLoading: boolean;
}) {
  const isMe = user.id === currentUserId;
  const displayName = [user.displayName, user.surname].filter(Boolean).join(" ") || `ID ${user.publicId}`;
  const inFollowingList = mode === "following";

  return (
    <TapScaleDiv
      className="flex items-center justify-between p-3 rounded-2xl hover:bg-secondary/50 transition-colors cursor-pointer"
      onClick={onProfileClick}
    >
      <div className="flex items-center gap-3 min-w-0">
        <UserAvatar
          avatarUrl={user.avatarUrl ?? undefined}
          displayName={displayName}
          seed={user.id}
          size={48}
          className="w-12 h-12 rounded-full flex-shrink-0"
        />
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-[15px] truncate">{displayName}</span>
          <span className="text-sm text-muted-foreground">ID {user.publicId}</span>
        </div>
      </div>
      {!isMe && currentUserId && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFollow(user.id, inFollowingList);
          }}
          disabled={followLoading}
          className={cn(
            "px-4 py-1.5 rounded-full text-[13px] font-medium transition-all active:scale-95 flex items-center gap-1.5 flex-shrink-0",
            inFollowingList
              ? "bg-secondary text-foreground hover:bg-secondary/80"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          aria-label={inFollowingList ? `Отписаться от ${displayName}` : `Подписаться на ${displayName}`}
        >
          {followLoading ? "…" : inFollowingList ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>В подписках</span>
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" />
              <span>Подписаться</span>
            </>
          )}
        </button>
      )}
    </TapScaleDiv>
  );
}
