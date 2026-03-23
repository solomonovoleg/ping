/**
 * Список подписчиков или подписок пользователя.
 * Маршрут: /profile/:id/followers | /profile/:id/following
 */
import { useState } from "react";
import { ChevronLeft, Search, UserPlus, UserMinus, Check, Users } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ListEmptyState } from "@/components/ui/empty";
import { TapScaleButton, TapScaleDiv } from "@/components/ui/tap-scale";
import { buildProfilePath } from "@/lib/profile-route";
import {
  fetchUserProfile,
  fetchFollowers,
  fetchFollowing,
  followUser,
  unfollowUser,
  removeMyFollower,
  type FollowUser,
} from "@/lib/users";
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
  const [removeLoading, setRemoveLoading] = useState<Record<string, boolean>>({});

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

  const { data: myFollowing = [] } = useQuery({
    queryKey: ["following", "viewer", user?.id ?? ""],
    queryFn: () => fetchFollowing(user!.id, 200),
    enabled: !!user?.id,
  });

  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const mode: Mode = pathname.includes("/following") ? "following" : "followers";
  const list = mode === "followers" ? followers : following;
  const isLoading = profileLoading || (mode === "followers" ? followersLoading : followingLoading);
  const viewerIsListOwner = !!user?.id && !!resolvedUserId && user.id === resolvedUserId;
  const myFollowingIds = new Set(myFollowing.map((x) => x.id));

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
        toast({ title: "Вы отписались", duration: 2000 });
      } else {
        await followUser(targetId);
        toast({ title: "Вы подписались", duration: 2000 });
      }
      void queryClient.invalidateQueries({ queryKey: ["followers"] });
      void queryClient.invalidateQueries({ queryKey: ["following"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    } finally {
      setFollowLoading((prev) => ({ ...prev, [targetId]: false }));
    }
  };

  const handleRemoveFollower = async (followerId: string, displayName: string) => {
    if (
      !window.confirm(
        `Убрать ${displayName} из подписчиков? Пользователь перестанет видеть ваши посты для подписчиков, но не будет заблокирован.`,
      )
    ) {
      return;
    }
    setRemoveLoading((prev) => ({ ...prev, [followerId]: true }));
    try {
      await removeMyFollower(followerId);
      toast({ title: "Подписчик убран", duration: 2000 });
      void queryClient.invalidateQueries({ queryKey: ["followers"] });
      void queryClient.invalidateQueries({ queryKey: ["following"] });
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    } finally {
      setRemoveLoading((prev) => ({ ...prev, [followerId]: false }));
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
                  iFollowThem={myFollowingIds.has(u.id)}
                  viewerIsListOwner={viewerIsListOwner}
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
                  onRemoveFollower={handleRemoveFollower}
                  removeLoading={removeLoading[u.id]}
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
  iFollowThem,
  viewerIsListOwner,
  onProfileClick,
  onToggleFollow,
  followLoading,
  onRemoveFollower,
  removeLoading,
}: {
  user: FollowUser;
  currentUserId?: string;
  mode: Mode;
  iFollowThem: boolean;
  viewerIsListOwner: boolean;
  onProfileClick: () => void;
  onToggleFollow: (id: string, currentlyFollowing: boolean) => void;
  followLoading: boolean;
  onRemoveFollower: (id: string, displayName: string) => void;
  removeLoading?: boolean;
}) {
  const isMe = user.id === currentUserId;
  const displayName = [user.displayName, user.surname].filter(Boolean).join(" ") || `ID ${user.publicId}`;
  const showRemoveFollower = viewerIsListOwner && mode === "followers" && !isMe && !!currentUserId;

  return (
    <TapScaleDiv
      className="flex items-center justify-between gap-2 p-3 rounded-2xl hover:bg-secondary/50 transition-colors cursor-pointer"
      onClick={onProfileClick}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
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
      {!isMe && currentUserId ? (
        <div className="flex flex-shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
          {showRemoveFollower ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveFollower(user.id, displayName);
              }}
              disabled={removeLoading}
              className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all active:scale-95 flex items-center gap-1 border border-destructive/40 text-destructive hover:bg-destructive/10 min-h-[var(--uix-touch-min)]"
              aria-label={`Убрать ${displayName} из подписчиков`}
            >
              {removeLoading ? (
                "…"
              ) : (
                <>
                  <UserMinus className="w-3.5 h-3.5" />
                  <span>Убрать</span>
                </>
              )}
            </button>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFollow(user.id, iFollowThem);
            }}
            disabled={followLoading}
            className={cn(
              "px-4 py-1.5 rounded-full text-[13px] font-medium transition-all active:scale-95 flex items-center gap-1.5 min-h-[var(--uix-touch-min)]",
              iFollowThem
                ? "bg-secondary text-foreground hover:bg-secondary/80"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
            aria-label={iFollowThem ? `Отписаться от ${displayName}` : `Подписаться на ${displayName}`}
          >
            {followLoading ? "…" : iFollowThem ? (
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
        </div>
      ) : null}
    </TapScaleDiv>
  );
}
