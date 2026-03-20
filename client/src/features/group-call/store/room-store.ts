import type { GroupCallMediaPreference, GroupCallRoomSnapshot } from "../types";

const initialSnapshot = (): GroupCallRoomSnapshot => ({
  roomId: null,
  chatId: null,
  phase: "idle",
  mediaPreference: "video",
  localParticipantId: null,
  participants: [],
  errorMessage: null,
  updatedAt: Date.now(),
});

type Listener = () => void;

/**
 * Лёгкий стор без внешних зависимостей. Позже можно заменить на Zustand в этой же папке.
 * Пока не используется из прод-UI — только каркас для модуля.
 */
export class GroupCallRoomStore {
  private snapshot: GroupCallRoomSnapshot = initialSnapshot();
  private listeners = new Set<Listener>();

  getSnapshot(): GroupCallRoomSnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    this.snapshot = { ...this.snapshot, updatedAt: Date.now() };
    this.listeners.forEach((l) => l());
  }

  reset(): void {
    this.snapshot = initialSnapshot();
    this.emit();
  }

  setPhase(phase: GroupCallRoomSnapshot["phase"], errorMessage: string | null = null): void {
    this.snapshot = { ...this.snapshot, phase, errorMessage };
    this.emit();
  }

  setContext(params: {
    roomId: string | null;
    chatId: string | null;
    localParticipantId: string | null;
    mediaPreference?: GroupCallMediaPreference;
  }): void {
    this.snapshot = {
      ...this.snapshot,
      roomId: params.roomId,
      chatId: params.chatId,
      localParticipantId: params.localParticipantId,
      mediaPreference: params.mediaPreference ?? this.snapshot.mediaPreference,
    };
    this.emit();
  }

  setParticipants(participants: GroupCallRoomSnapshot["participants"]): void {
    this.snapshot = { ...this.snapshot, participants: [...participants] };
    this.emit();
  }
}

/** Синглтон модуля; тет-а-тет стор не трогаем. */
export const groupCallRoomStore = new GroupCallRoomStore();
