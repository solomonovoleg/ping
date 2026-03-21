import { UserAvatar } from "@/components/UserAvatar";
import { resolveUrl } from "@/lib/api-base";
import { usePulseProfileTheme } from "../pulse-profile-theme";
import type { PulseProfileMutualFollowersModel } from "./types";
import { mutualFollowersLabelRu } from "./mutual-label-ru";

export function PulseProfileMutualFollowersRow({ data }: { data: PulseProfileMutualFollowersModel }) {
  const { th } = usePulseProfileTheme();
  const preview = data.preview.slice(0, 3);
  if (data.count <= 0) return null;
  return (
    <div className="mt-2.5 flex items-center gap-1.5">
      {preview.length > 0 ? (
        <div className="flex items-center">
          {preview.map((u, i) => (
            <div
              key={u.id}
              className="relative shrink-0 rounded-full border-[1.5px]"
              style={{
                borderColor: th.bg,
                marginLeft: i > 0 ? -7 : 0,
                zIndex: preview.length - i,
              }}
            >
              <UserAvatar
                avatarUrl={u.avatarUrl ? resolveUrl(u.avatarUrl) : undefined}
                displayName={[u.displayName, u.surname].filter(Boolean).join(" ") || `ID ${u.publicId}`}
                seed={u.id}
                size={20}
                className="h-5 w-5"
              />
            </div>
          ))}
        </div>
      ) : null}
      <span style={{ fontSize: 11.5, color: th.textFaint, fontWeight: 500 }}>{mutualFollowersLabelRu(data.count)}</span>
    </div>
  );
}
