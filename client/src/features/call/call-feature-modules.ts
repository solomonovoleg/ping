import type {
  CallCaptionEvent,
  CallFeatureSupport,
  CallNetworkQualityLevel,
  CallReactionEvent,
} from "./call-types";

export interface CallFeatureModulesState {
  networkQuality: CallNetworkQualityLevel;
  recordingState: "idle" | "recording" | "stopping" | "error";
  localReactions: CallReactionEvent[];
  remoteReactions: CallReactionEvent[];
  captions: CallCaptionEvent[];
  captionsEnabled: boolean;
}

export const INITIAL_CALL_FEATURE_MODULES_STATE: CallFeatureModulesState = {
  networkQuality: "unknown",
  recordingState: "idle",
  localReactions: [],
  remoteReactions: [],
  captions: [],
  captionsEnabled: false,
};

export const DISABLED_CALL_FEATURE_SUPPORT: CallFeatureSupport = {
  networkQuality: false,
  cameraFlip: false,
  screenShare: false,
  localRecording: false,
  reactions: false,
  captionsRelay: false,
  captionsLocalSTT: false,
};
