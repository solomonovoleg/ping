export type GroupTranscriptSegment = {
  id: string;
  callId: string;
  speakerUserId: string;
  speakerDisplayName: string;
  textNormalized: string;
  isFinal: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type GroupCommandSuggestion = {
  id: string;
  callId: string;
  segmentId: string | null;
  title: string;
  intentType: string;
  payloadJson: string;
  status: "pending" | "accepted" | "dismissed";
  createdAt: string;
};
