export type ParsedMoneyUpstream = {
  edgeType?: string;
  interactLocked?: boolean;
  creatorPlatformUserId?: string | null;
  money?: {
    scoringRules?: Array<{ kind?: string; enabled?: boolean; points?: number; threshold?: number }>;
    inviteDm?: { template?: string; codeExpiresInHours?: number };
  };
};

export function parseMoneyUpstreamJson(body: string): ParsedMoneyUpstream | null {
  try {
    return JSON.parse(body) as ParsedMoneyUpstream;
  } catch {
    return null;
  }
}
