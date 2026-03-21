export function mutualFollowersLabelRu(count: number): string {
  const n100 = count % 100;
  if (n100 >= 11 && n100 <= 14) return `${count} общих подписчиков`;
  const n10 = count % 10;
  if (n10 === 1) return `${count} общий подписчик`;
  if (n10 >= 2 && n10 <= 4) return `${count} общих подписчика`;
  return `${count} общих подписчиков`;
}
