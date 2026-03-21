import { collectNativeContactPhoneStrings, isNative } from "@/lib/capacitor-native";

type NavigatorWithContacts = Navigator & {
  contacts?: {
    select(
      properties: string[],
      options?: { multiple?: boolean }
    ): Promise<Array<Record<string, string | string[] | undefined>>>;
  };
};

export function isWebContactPickerSupported(): boolean {
  return typeof navigator !== "undefined" && typeof (navigator as NavigatorWithContacts).contacts?.select === "function";
}

/** Chrome/Android: пользователь выбирает контакты; null — API нет или сбой. */
export async function pickPhonesFromWebContactPicker(): Promise<string[] | null> {
  const nav = navigator as NavigatorWithContacts;
  if (!nav.contacts?.select) return null;
  try {
    const picked = await nav.contacts.select(["tel"], { multiple: true });
    if (!Array.isArray(picked) || picked.length === 0) return [];
    const out: string[] = [];
    for (const c of picked) {
      const tel = c.tel;
      if (Array.isArray(tel)) {
        for (const t of tel) {
          if (typeof t === "string" && t.trim()) out.push(t);
        }
      } else if (typeof tel === "string" && tel.trim()) {
        out.push(tel);
      }
    }
    return out;
  } catch {
    return null;
  }
}

export async function gatherPhoneStringsFromDevice(): Promise<{
  phones: string[];
  source: "native" | "web_picker" | "none";
}> {
  if (isNative()) {
    const phones = await collectNativeContactPhoneStrings();
    return { phones, source: "native" };
  }
  const web = await pickPhonesFromWebContactPicker();
  if (web === null) return { phones: [], source: "none" };
  return { phones: web, source: "web_picker" };
}
