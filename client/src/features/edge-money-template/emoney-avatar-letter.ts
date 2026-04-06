export function emoneyDisplayInitial(name: string | undefined | null): string {
  const t = (name ?? "").trim();
  if (!t) return "?";
  const c = t.charAt(0).toUpperCase();
  return /[A-ZА-ЯЁ0-9]/i.test(c) ? c : "?";
}
