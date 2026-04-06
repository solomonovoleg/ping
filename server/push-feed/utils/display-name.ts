export function resolveDisplayName(input: {
  displayName: string | null;
  surname: string | null;
  publicId: number | null;
}): string {
  const name = [input.displayName, input.surname].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (input.publicId != null) return `ID ${input.publicId}`;
  return "Пользователь";
}
