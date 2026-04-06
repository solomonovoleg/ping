import { Bookmark, Grid3x3, Tag, type LucideIcon } from "lucide-react";
import type { PulseProfileTabKey } from "./types";

export type PulseProfileTabConfigItem = {
  key: PulseProfileTabKey;
  Icon: LucideIcon;
  label: string;
};

export const PULSE_PROFILE_TAB_ITEMS: PulseProfileTabConfigItem[] = [
  { key: "posts", Icon: Grid3x3, label: "Посты" },
  { key: "saved", Icon: Bookmark, label: "Сохранено" },
  { key: "tagged", Icon: Tag, label: "Отметки" },
];
