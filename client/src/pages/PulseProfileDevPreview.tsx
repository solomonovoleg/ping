import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { LayoutGrid } from "lucide-react";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ListEmptyState } from "@/components/ui/empty";
import { UserAvatar } from "@/components/UserAvatar";
import {
  PulseProfileLayout,
  PulseProfileAddContentStrip,
  PULSE_PROFILE_AVATAR_INNER_PX,
  PULSE_PROFILE_AVATAR_SQUIRCLE_INNER_RX,
  type PulseProfileTabKey,
} from "@/features/profile/pulse-profile";
import { ProfileMePulseActions } from "@/features/profile/user-profile";

/**
 * Dev: мобильный макет профиля PULSE (тот же `PulseProfileLayout`, что и `/profile/me`).
 * Тема фиксирована тёмной, чтобы совпадать с `/dev/pulse-template` без `html.dark`.
 */
export default function PulseProfileDevPreview() {
  const [, setLocation] = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<PulseProfileTabKey>("posts");
  const [postView, setPostView] = useState<"list" | "grid">("list");
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [coverScrollY, setCoverScrollY] = useState(0);

  return (
    <div
      className="flex min-h-[100dvh] w-full justify-center text-white"
      style={{
        fontFamily: "-apple-system,BlinkMacSystemFont,'Inter',sans-serif",
        background: "#080810",
      }}
    >
      <div className="relative h-[100dvh] w-full max-w-[390px] overflow-hidden shadow-2xl shadow-black/50">
        <PullToRefresh
          scrollRef={scrollRef}
          className="flex h-full min-h-0 flex-col"
          onRefresh={async () => {}}
          disabled
        >
          <PulseProfileLayout
            themeMode="dark"
            scrollRef={scrollRef}
            coverUrl={null}
            onCoverError={() => {}}
            onBack={() => setLocation("/dev/pulse-template")}
            onMore={() => {}}
            usernamePill="oleg_solomonov"
            displayName="Олег Соломонов"
            showVerified
            idChip="Founder · ID 2"
            genderChip="Мужской"
            birthChip="12 мар 1995"
            cityChip="Москва"
            bio="Создал PULSE 🔥 Потому что не где было общаться"
            linkDisplay="pulse.app"
            linkHref="https://pulse.app"
            postsCount={1}
            followersCount={5}
            followingCount={35}
            onFollowersClick={() => {}}
            onFollowingClick={() => {}}
            actionRow={
              <ProfileMePulseActions onEdit={() => setLocation("/profile/edit")} onShare={() => {}} />
            }
            onHighlightNew={() => {}}
            mutualFollowers={{
              count: 3,
              preview: [
                { id: "m1", publicId: 101, displayName: "Алёна", surname: null, avatarUrl: null },
                { id: "m2", publicId: 102, displayName: "Мария", surname: null, avatarUrl: null },
                { id: "m3", publicId: 103, displayName: "Иван", surname: null, avatarUrl: null },
              ],
            }}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            postView={postView}
            onTogglePostView={() => setPostView((v) => (v === "list" ? "grid" : "list"))}
            addContentStrip={
              activeTab === "posts" ? (
                <PulseProfileAddContentStrip onClick={() => setLocation("/create-post")} disabled={false} />
              ) : null
            }
            postsContent={
              <div className="min-h-[200px] px-2 py-6">
                <ListEmptyState
                  icon={LayoutGrid}
                  title="Макет профиля"
                  description="Здесь лента постов на реальном экране /profile/me"
                />
              </div>
            }
            avatarInner={
              <UserAvatar
                displayName="Олег Соломонов"
                seed="pulse-dev-profile"
                size={PULSE_PROFILE_AVATAR_INNER_PX}
                cornerRadius={PULSE_PROFILE_AVATAR_SQUIRCLE_INNER_RX}
                className="h-full w-full object-cover"
              />
            }
            hasStoryGradient
            onAvatarPress={() => {}}
            showAvatarPlus
            onAvatarPlusClick={() => setAvatarMenuOpen((o) => !o)}
            avatarMenuOpen={avatarMenuOpen}
            onAvatarMenuOpenChange={setAvatarMenuOpen}
            avatarMenuItems={[
              { label: "Добавить сторис", onClick: () => setAvatarMenuOpen(false) },
              { label: "Редактировать профиль", onClick: () => setLocation("/profile/edit") },
              { label: "Обложка профиля", onClick: () => setLocation("/profile/edit") },
            ]}
          />
        </PullToRefresh>
      </div>
    </div>
  );
}
