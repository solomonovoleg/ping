import type { BlockPresetId, UserBlockFlags } from "./types";

/** Каталог пресетов блокировки (OOP: инкапсуляция вариантов и текстов). */
export class BlockPresetCatalog {
  private static readonly PRESETS: Record<BlockPresetId, UserBlockFlags> = {
    chatOnly: { restrictProfile: false, restrictChat: true, restrictSocial: false },
    chatAndSocial: { restrictProfile: false, restrictChat: true, restrictSocial: true },
    socialOnly: { restrictProfile: false, restrictChat: false, restrictSocial: true },
    full: { restrictProfile: true, restrictChat: true, restrictSocial: true },
  };

  static flags(id: BlockPresetId): UserBlockFlags {
    return { ...this.PRESETS[id] };
  }

  static summary(id: BlockPresetId): string {
    switch (id) {
      case "full":
        return "Он не сможет писать вам, видеть профиль и взаимодействовать в ленте.";
      case "chatAndSocial":
        return "Не сможет писать вам в личку и оставлять реакции/комментарии.";
      case "socialOnly":
        return "Он не сможет ставить реакции и оставлять комментарии у вас.";
      default:
        return "Он не сможет писать вам в личку.";
    }
  }

  /** Совместимость с `client/src/lib/users.ts`: пресеты без переименования ключей. */
  static readonly apiPresets = {
    full: BlockPresetCatalog.PRESETS.full,
    chatOnly: BlockPresetCatalog.PRESETS.chatOnly,
    chatAndSocial: BlockPresetCatalog.PRESETS.chatAndSocial,
    socialOnly: BlockPresetCatalog.PRESETS.socialOnly,
  } as const satisfies Record<string, UserBlockFlags>;
}
