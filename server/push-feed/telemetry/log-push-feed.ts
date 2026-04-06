export function logPushFanout(params: { postId: string; authorId: string; subscribers: number }): void {
  console.info("[push-feed] fanout", params);
}
