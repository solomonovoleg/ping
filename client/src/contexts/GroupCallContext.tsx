import { createContext, useCallback, useContext, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isGroupCallModuleEnabled } from "@/features/group-call/flags";
import { createGroupCallRoom, type GroupCallMedia } from "@/lib/group-calls-api";
import { GroupCallModal } from "@/features/group-call/ui/GroupCallModal";
import { toast } from "@/hooks/use-toast";

type ActiveGroupCall = {
  roomId: string;
  chatId: string;
  mediaType: GroupCallMedia;
  chatTitle: string;
};

type GroupCallContextValue = {
  active: ActiveGroupCall | null;
  startGroupCall: (chatId: string, chatTitle: string, video: boolean) => Promise<void>;
  joinGroupCall: (opts: ActiveGroupCall) => void;
  dismissGroupCall: () => void;
};

const GroupCallContext = createContext<GroupCallContextValue | null>(null);

export function GroupCallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [active, setActive] = useState<ActiveGroupCall | null>(null);

  const dismissGroupCall = useCallback(() => setActive(null), []);

  const startGroupCall = useCallback(
    async (chatId: string, chatTitle: string, video: boolean) => {
      if (!isGroupCallModuleEnabled()) return;
      try {
        const data = await createGroupCallRoom(chatId, video ? "video" : "audio");
        setActive({
          roomId: data.roomId,
          chatId,
          mediaType: data.mediaType,
          chatTitle,
        });
      } catch (e) {
        toast({
          title: e instanceof Error ? e.message : "Не удалось начать групповой звонок",
          variant: "destructive",
        });
      }
    },
    [],
  );

  const joinGroupCall = useCallback((opts: ActiveGroupCall) => {
    if (!isGroupCallModuleEnabled()) return;
    setActive(opts);
  }, []);

  const myDisplayName =
    [user?.displayName, user?.surname].filter(Boolean).join(" ").trim() || user?.phone?.trim() || "Вы";

  return (
    <GroupCallContext.Provider value={{ active, startGroupCall, joinGroupCall, dismissGroupCall }}>
      {children}
      {active && user ? (
        <GroupCallModal
          open
          chatTitle={active.chatTitle}
          roomId={active.roomId}
          mediaType={active.mediaType}
          myUserId={user.id}
          myDisplayName={myDisplayName}
          onClose={dismissGroupCall}
        />
      ) : null}
    </GroupCallContext.Provider>
  );
}

export function useGroupCallContext(): GroupCallContextValue {
  const ctx = useContext(GroupCallContext);
  if (!ctx) throw new Error("useGroupCallContext must be used within GroupCallProvider");
  return ctx;
}
