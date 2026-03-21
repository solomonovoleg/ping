import { isNative } from "@/lib/capacitor-native";

export type ChatPlatformKind = "ios" | "android" | "web";
export type ChatBackgroundPreset = "matte_black" | "velvet_gradient" | "obsidian_black";
export type ChatMessageBubblePreset = "primary" | "slate" | "violet" | "sky";

export const CHAT_BG_STORAGE_PREFIX = "ping-chat-bg:";
export const CHAT_MSG_COLOR_STORAGE_PREFIX = "ping-chat-msg-color:";

export const CHAT_BG_PRESETS: Array<{
  id: ChatBackgroundPreset;
  title: string;
  description: string;
  swatchClassName: string;
  darkBgClassName: string;
}> = [
  {
    id: "matte_black",
    title: "Матовый черный",
    description: "Строгий черный, слегка матовый",
    swatchClassName: "bg-[linear-gradient(180deg,#050505_0%,#0c0c0c_50%,#111_100%)]",
    darkBgClassName: "bg-[linear-gradient(180deg,#050505_0%,#0c0c0c_50%,#111_100%)]",
  },
  {
    id: "velvet_gradient",
    title: "Премиум градиент",
    description: "Тёплый градиент с фиолетовым оттенком",
    swatchClassName: "bg-[radial-gradient(140%_120%_at_30%_-10%,#2a1f3d_0%,#1a1425_35%,#0d0a12_70%,#050408_100%)]",
    darkBgClassName: "bg-[radial-gradient(140%_120%_at_30%_-10%,#2a1f3d_0%,#1a1425_35%,#0d0a12_70%,#050408_100%)]",
  },
  {
    id: "obsidian_black",
    title: "Obsidian Black",
    description: "Холодный черный с синим отблеском",
    swatchClassName: "bg-[radial-gradient(150%_110%_at_85%_-5%,#0d1820_0%,#081118_40%,#040a0f_75%,#020508_100%)]",
    darkBgClassName: "bg-[radial-gradient(150%_110%_at_85%_-5%,#0d1820_0%,#081118_40%,#040a0f_75%,#020508_100%)]",
  },
];

export function isChatBackgroundPreset(value: string): value is ChatBackgroundPreset {
  return CHAT_BG_PRESETS.some((preset) => preset.id === value);
}

export function getChatBackgroundStorageKey(chatId: string): string {
  return `${CHAT_BG_STORAGE_PREFIX}${chatId}`;
}

export const MSG_BUBBLE_PRESETS: Array<{
  id: ChatMessageBubblePreset;
  title: string;
  swatchClassName: string;
}> = [
  { id: "primary", title: "Основной", swatchClassName: "bg-primary" },
  { id: "slate", title: "Серый", swatchClassName: "bg-slate-500" },
  { id: "violet", title: "Фиолетовый", swatchClassName: "bg-violet-500" },
  { id: "sky", title: "Голубой", swatchClassName: "bg-sky-500" },
];

export function isChatMessageBubblePreset(value: string): value is ChatMessageBubblePreset {
  return MSG_BUBBLE_PRESETS.some((preset) => preset.id === value);
}

export function getChatMsgColorStorageKey(chatId: string): string {
  return `${CHAT_MSG_COLOR_STORAGE_PREFIX}${chatId}`;
}

export function detectChatPlatform(): ChatPlatformKind {
  if (!isNative()) return "web";
  try {
    const maybeCap = window as unknown as { Capacitor?: { getPlatform?: () => string } };
    const platform = maybeCap.Capacitor?.getPlatform?.();
    if (platform === "ios" || platform === "android") return platform;
  } catch {
    /* fallback */
  }
  return "web";
}
