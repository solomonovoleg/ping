export interface ScreenShareSession {
  stop: () => Promise<void>;
}

export async function startScreenShare(
  pc: RTCPeerConnection,
  localStream: MediaStream,
): Promise<ScreenShareSession> {
  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: { ideal: 24, max: 30 },
      width: { max: 1920, ideal: 1280 },
      height: { max: 1080, ideal: 720 },
    },
    audio: false,
  });
  const displayTrack = displayStream.getVideoTracks()[0];
  if (!displayTrack) {
    throw new Error("Не удалось получить экран для шаринга");
  }
  try {
    displayTrack.contentHint = "detail";
  } catch {
    /* не все движки поддерживают */
  }

  const sender = pc.getSenders().find((s) => s.track?.kind === "video");
  if (!sender) {
    displayTrack.stop();
    throw new Error("Не найден video sender");
  }

  const cameraTrack = localStream.getVideoTracks()[0] ?? null;
  await sender.replaceTrack(displayTrack);

  if (cameraTrack) {
    localStream.removeTrack(cameraTrack);
  }
  localStream.addTrack(displayTrack);

  const stop = async () => {
    if (cameraTrack) {
      await sender.replaceTrack(cameraTrack);
      localStream.removeTrack(displayTrack);
      localStream.addTrack(cameraTrack);
    }
    displayTrack.stop();
    displayStream.getTracks().forEach((t) => t.stop());
  };

  return { stop };
}
