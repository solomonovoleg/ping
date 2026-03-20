import type { GroupMeshRegistry } from "../session/mesh-registry";

export type GroupScreenShareSession = {
  stop: () => Promise<void>;
};

/**
 * Демонстрация экрана в mesh: один display track на все исходящие video sender.
 * Работает в видеозвонке (есть исходящий video track). Для аудиозвонка — отдельно не поддерживаем (нужна ре-негоциация).
 */
export async function startGroupScreenShare(
  mesh: GroupMeshRegistry,
  localStream: MediaStream,
  options?: { onStopped?: () => void },
): Promise<GroupScreenShareSession> {
  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
  });
  const displayTrack = displayStream.getVideoTracks()[0];
  if (!displayTrack) {
    displayStream.getTracks().forEach((t) => t.stop());
    throw new Error("Не удалось получить экран для демонстрации");
  }

  const cameraTrack = localStream.getVideoTracks()[0] ?? null;
  if (!cameraTrack) {
    displayTrack.stop();
    displayStream.getTracks().forEach((t) => t.stop());
    throw new Error("Демонстрация экрана доступна только в видеозвонке");
  }

  let screenClones: MediaStreamTrack[] = [];
  try {
    screenClones = await mesh.replaceOutgoingScreenVideoTrack(displayTrack);
  } catch (e) {
    displayTrack.stop();
    displayStream.getTracks().forEach((t) => t.stop());
    throw e;
  }
  localStream.removeTrack(cameraTrack);
  localStream.addTrack(displayTrack);

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    displayTrack.onended = null;
    try {
      await mesh.replaceOutgoingVideoTrackOnAllLinks(cameraTrack);
    } catch {
      /* ignore */
    }
    for (const c of screenClones) {
      try {
        c.stop();
      } catch {
        /* ignore */
      }
    }
    screenClones = [];
    try {
      localStream.removeTrack(displayTrack);
      if (cameraTrack.readyState === "live") {
        localStream.addTrack(cameraTrack);
      }
    } catch {
      /* ignore */
    }
    displayTrack.stop();
    displayStream.getTracks().forEach((t) => t.stop());
    options?.onStopped?.();
  };

  displayTrack.onended = () => {
    void stop();
  };

  return { stop };
}
