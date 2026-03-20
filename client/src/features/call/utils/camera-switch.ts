import type { CallCameraFacingMode } from "../call-types";

export async function switchCameraTrack(
  pc: RTCPeerConnection,
  localStream: MediaStream,
  currentFacing: CallCameraFacingMode,
): Promise<{ nextTrack: MediaStreamTrack; facingMode: CallCameraFacingMode }> {
  const nextFacing: CallCameraFacingMode = currentFacing === "user" ? "environment" : "user";
  const nextMedia = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: nextFacing } },
    audio: false,
  });

  const newTrack = nextMedia.getVideoTracks()[0];
  if (!newTrack) {
    throw new Error("Камера недоступна");
  }

  const sender = pc.getSenders().find((s) => s.track?.kind === "video");
  if (!sender) {
    newTrack.stop();
    throw new Error("Не найден video sender");
  }

  await sender.replaceTrack(newTrack);

  const oldTrack = localStream.getVideoTracks()[0];
  if (oldTrack) {
    localStream.removeTrack(oldTrack);
    oldTrack.stop();
  }
  localStream.addTrack(newTrack);

  return { nextTrack: newTrack, facingMode: nextFacing };
}
