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
  hostUserId?: string | null;
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
      if (!isGroupCallModuleEnabled()) {
        toast({
          title: "Групповые звонки выключены в этой сборке",
          description: "Добавьте в deploy.env: VITE_GROUP_CALLS_ENABLED=1 и GROUP_CALLS_ENABLED=1, затем пересоберите и задеплойте.",
          variant: "destructive",
        });
        return;
      }
      const cid = chatId.trim();
      if (!cid) {
        toast({ title: "Чат ещё не готов", description: "Подождите загрузки и попробуйте снова.", variant: "destructive" });
        return;
      }
      try {
        const data = await createGroupCallRoom(cid, video ? "video" : "audio");
        setActive({
          roomId: data.roomId,
          chatId: cid,
          mediaType: data.mediaType,
          chatTitle,
          hostUserId: data.hostUserId ?? user?.id ?? null,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Не удалось начать групповой звонок";
        toast({ title: msg, variant: "destructive" });
        if (import.meta.env.DEV) console.warn("[group-call] startGroupCall failed", e);
      }
    },
    [user?.id],
  );

  const joinGroupCall = useCallback((opts: ActiveGroupCall) => {
    if (!isGroupCallModuleEnabled()) {
      toast({
        title: "Групповые звонки выключены",
        description: "Включите VITE_GROUP_CALLS_ENABLED при сборке и GROUP_CALLS_ENABLED на сервере.",
        variant: "destructive",
      });
      return;
    }
    setActive(opts);
  }, []);

  const myDisplayName =
    [user?.displayName, user?.surname].filter(Boolean).join(" ").trim() || user?.phone?.trim() || "Вы";

  return (
    <GroupCallContext.Provider value={{ active, startGroupCall, joinGroupCall, dismissGroupCall }}>
      {children}
      {active && user ? (
        <GroupCallModal
          key={active.roomId}
          open
          chatId={active.chatId}
          chatTitle={active.chatTitle}
          roomId={active.roomId}
          mediaType={active.mediaType}
          myUserId={user.id}
          myDisplayName={myDisplayName}
          hostUserId={active.hostUserId ?? null}
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
