import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { detectChatPlatform, type ChatPlatformKind } from "./chat-appearance-presets";

export function useChatSpacingPreset() {
  const isMobile = useIsMobile();
  const [platform, setPlatform] = useState<ChatPlatformKind>("web");

  useEffect(() => {
    setPlatform(detectChatPlatform());
  }, []);

  const isDesktopWeb = platform === "web" && !isMobile;
  const isIos = platform === "ios";
  const isAndroid = platform === "android";

  return {
    headerYClass: isDesktopWeb ? "py-3.5" : isAndroid ? "py-2.5" : isIos ? "py-3.5" : "py-3",
    bottomBarYClass: isDesktopWeb ? "py-3" : isAndroid ? "py-2" : isIos ? "py-2.5" : "py-2.5",
    messageTopPaddingClass: isDesktopWeb ? "pt-6" : isAndroid ? "pt-3.5" : "pt-4",
    aiListBottomPad: isDesktopWeb
      ? "calc(12rem + env(safe-area-inset-bottom,0px))"
      : isAndroid
        ? "calc(10.5rem + env(safe-area-inset-bottom,0px))"
        : "calc(11rem + env(safe-area-inset-bottom,0px))",
    chatListBottomPad: isDesktopWeb
      ? "calc(104px + env(safe-area-inset-bottom,0px))"
      : isAndroid
        ? "calc(92px + env(safe-area-inset-bottom,0px))"
        : "calc(98px + env(safe-area-inset-bottom,0px))",
  };
}
