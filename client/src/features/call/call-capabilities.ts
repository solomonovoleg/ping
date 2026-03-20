import type { CallFeatureFlags, CallFeatureSupport } from "./call-types";

export function getCallFeatureSupport(flags: CallFeatureFlags): CallFeatureSupport {
  const hasWindow = typeof window !== "undefined";
  const hasNavigator = typeof navigator !== "undefined";
  const hasMediaDevices = hasNavigator && Boolean(navigator.mediaDevices);
  const hasEnumerateDevices = typeof navigator.mediaDevices?.enumerateDevices === "function";
  const hasDisplayMedia = typeof navigator.mediaDevices?.getDisplayMedia === "function";
  const hasMediaRecorder = typeof window !== "undefined" && "MediaRecorder" in window;
  const hasRtcStats = typeof window !== "undefined" && "RTCPeerConnection" in window;
  const hasSpeechRecognition =
    typeof window !== "undefined" &&
    (Boolean((window as { SpeechRecognition?: unknown }).SpeechRecognition) ||
      Boolean((window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition));

  return {
    networkQuality: flags.networkQuality && hasRtcStats,
    cameraFlip: flags.cameraFlip && hasMediaDevices && hasEnumerateDevices,
    screenShare: flags.screenShare && hasMediaDevices && hasDisplayMedia,
    localRecording: flags.localRecording && hasMediaRecorder,
    reactions: flags.reactions,
    captionsRelay: flags.captionsRelay,
    captionsLocalSTT: flags.captionsRelay && hasSpeechRecognition,
  };
}
