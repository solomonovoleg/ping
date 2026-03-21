import {
  MessengerChatDark,
  MessengerChatLight,
  MobileChatDark,
  MobileStoriesViewer,
} from "@/features/chat/pulse-template";
import { useLocation } from "wouter";

const fontStack = "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif";

/**
 * Эталон PULSE (макеты из `pulse-template/`). Только dev, без подмены ChatDetail.
 *
 * - `/dev/pulse-template` — мобильный тёмный (390px)
 * - `/dev/pulse-template/desktop` — десктоп тёмный (1280×720, на весь viewport)
 * - `/dev/pulse-template/desktop-light` — десктоп светлый
 * - `/dev/pulse-template/stories` — макет «мои сториз» (мок)
 * - `/dev/pulse-template/stories-other` — макет «чужие сториз» (мок)
 * - `/dev/pulse-template/profile` — мобильный профиль PULSE (`PulseProfileLayout`, мок-данные)
 */
export default function PulseTemplatePreview() {
  const [location] = useLocation();

  if (location === "/dev/pulse-template/stories-other") {
    return (
      <div
        className="flex min-h-[100dvh] w-full justify-center bg-[#080810] text-white"
        style={{ fontFamily: fontStack }}
      >
        <div className="relative w-full max-w-[390px] shadow-2xl shadow-black/50">
          <MobileStoriesViewer initialMode="other" />
        </div>
      </div>
    );
  }

  if (location === "/dev/pulse-template/stories") {
    return (
      <div
        className="flex min-h-[100dvh] w-full justify-center bg-[#080810] text-white"
        style={{ fontFamily: fontStack }}
      >
        <div className="relative w-full max-w-[390px] shadow-2xl shadow-black/50">
          <MobileStoriesViewer />
        </div>
      </div>
    );
  }

  if (location === "/dev/pulse-template/desktop-light") {
    return (
      <div
        className="min-h-[100dvh] w-full overflow-hidden text-neutral-900"
        style={{ fontFamily: fontStack }}
      >
        <MessengerChatLight />
      </div>
    );
  }

  if (location === "/dev/pulse-template/desktop") {
    return (
      <div
        className="min-h-[100dvh] w-full overflow-hidden bg-[#080810] text-white"
        style={{ fontFamily: fontStack }}
      >
        <MessengerChatDark />
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[100dvh] w-full justify-center bg-[#080810] text-white"
      style={{ fontFamily: fontStack }}
    >
      <div className="relative w-full max-w-[390px] shadow-2xl shadow-black/50">
        <MobileChatDark />
      </div>
    </div>
  );
}
