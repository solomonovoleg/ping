/** PostgreSQL unique_violation */
export function isPgUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}

export function throwFriendlyIfDuplicateUserWall(e: unknown): never {
  if (isPgUniqueViolation(e)) {
    throw new Error(
      "У этого автора уже есть привязка к этой стене ВК (тот же owner_id). Выберите другого пользователя платформы или другую стену.",
    );
  }
  throw e;
}
