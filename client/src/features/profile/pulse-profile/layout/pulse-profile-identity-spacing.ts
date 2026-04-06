/** Верхний отступ био: плотнее к карточке, если нет строки общих подписчиков. */
export function pulseProfileIdentityBioMarginTopPx(showMutualFollowersRow: boolean): number {
  return showMutualFollowersRow ? 12 : 2;
}
