import { useCallback, useEffect, useState } from "react";
import { isGroupCallModuleEnabled } from "../flags";
import { groupCallRoomStore } from "../store/room-store";
import type { GroupCallRoomSnapshot } from "../types";

/**
 * Единственная «точка входа» для UI после готовности модуля.
 * При выключенном флаге возвращает `enabled: false` и не подписывается на стор.
 */
export function useGroupCallModule(): {
  enabled: boolean;
  room: GroupCallRoomSnapshot | null;
  resetRoom: () => void;
} {
  const enabled = isGroupCallModuleEnabled();
  const [room, setRoom] = useState<GroupCallRoomSnapshot | null>(() =>
    enabled ? groupCallRoomStore.getSnapshot() : null,
  );

  useEffect(() => {
    if (!enabled) {
      setRoom(null);
      return;
    }
    setRoom(groupCallRoomStore.getSnapshot());
    return groupCallRoomStore.subscribe(() => {
      setRoom(groupCallRoomStore.getSnapshot());
    });
  }, [enabled]);

  const resetRoom = useCallback(() => {
    if (!enabled) return;
    groupCallRoomStore.reset();
  }, [enabled]);

  return { enabled, room, resetRoom };
}
