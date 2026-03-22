export type PingokMicroIntent =
  | "message"
  | "call"
  | "task"
  | "remind"
  | "plan"
  | "memory_search"
  | "other";

export interface PingokMicroParseRequest {
  text: string;
}

export interface PingokMicroParseResponse {
  intent: PingokMicroIntent;
  commandText: string;
}
