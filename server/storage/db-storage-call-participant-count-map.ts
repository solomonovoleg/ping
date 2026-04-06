export function callParticipantCountsToMap(rows: { callId: string; count: number }[]): Map<string, number> {
  return new Map(rows.map((r) => [r.callId, r.count]));
}
