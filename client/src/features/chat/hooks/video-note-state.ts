export type VideoNoteStage =
  | "idle"
  | "holding"
  | "recording"
  | "locked"
  | "preview"
  | "sending"
  | "error";

export type VideoNoteModalPhase = "recording" | "preview";

export function isVideoNoteRecordingStage(stage: VideoNoteStage): boolean {
  return stage === "recording" || stage === "locked";
}

export function shouldShowVideoNoteModal(stage: VideoNoteStage): boolean {
  return stage === "recording" || stage === "locked" || stage === "preview";
}

export function getVideoNoteModalPhase(stage: VideoNoteStage): VideoNoteModalPhase | null {
  if (stage === "preview") return "preview";
  if (isVideoNoteRecordingStage(stage)) return "recording";
  return null;
}

export function withVideoNoteLock(stage: VideoNoteStage, locked: boolean): VideoNoteStage {
  if (!isVideoNoteRecordingStage(stage)) return stage;
  return locked ? "locked" : "recording";
}

export function toLegacyVideoNoteState(stage: VideoNoteStage): "idle" | "recording" | "preview" {
  if (stage === "preview") return "preview";
  if (isVideoNoteRecordingStage(stage)) return "recording";
  return "idle";
}
