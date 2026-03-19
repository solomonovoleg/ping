/**
 * Раскрывающийся список участников группового чата.
 * Добавление и исключение участников (для админов).
 */
import { useState } from "react";
import { UserAvatar } from "@/components/UserAvatar";
import { buildProfilePath } from "@/lib/profile-route";
import { useLocation } from "wouter";
import { UserPlus, UserMinus } from "lucide-react";
import { addGroupMember, removeGroupMember } from "@/lib/chat";
import { listContactsWithProfiles, type ContactUser } from "@/lib/users";
import { useToast } from "@/hooks/use-toast";
import type { ApiChat, ApiChatMember } from "../types";

export function GroupChatParticipantsSheet({
  chatId,
  members,
  currentUserId,
  isAdmin,
  onClose,
  onMembersChange,
}: {
  chatId: string;
  members: ApiChatMember[];
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
  onMembersChange: (updatedChat: ApiChat) => void;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [contacts, setContacts] = useState<ContactUser[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [removeLoadingId, setRemoveLoadingId] = useState<string | null>(null);

  const memberIds = new Set(members.map((m) => m.id));
  const memberName = (m: ApiChatMember) =>
    [m.displayName, m.surname].filter(Boolean).join(" ") || `ID ${m.publicId ?? ""}`;
  const contactDisplayName = (c: ContactUser) =>
    [c.displayName, c.surname].filter(Boolean).join(" ") || `ID ${c.publicId}`;

  const openAddPicker = async () => {
    setShowAddPicker(true);
    try {
      const list = await listContactsWithProfiles();
      setContacts(list.filter((c) => !memberIds.has(c.id)));
    } catch {
      toast({ title: "Не удалось загрузить контакты", variant: "destructive" });
    }
  };

  const handleAdd = async (userId: string) => {
    setAddLoading(true);
    try {
      const updated = await addGroupMember(chatId, userId);
      onMembersChange(updated as ApiChat);
      setContacts((prev) => prev.filter((c) => c.id !== userId));
      window.dispatchEvent(new CustomEvent("ping:chat-list-update"));
      toast({ title: "Участник добавлен" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Не удалось добавить", variant: "destructive" });
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setRemoveLoadingId(userId);
    try {
      const updated = await removeGroupMember(chatId, userId);
      onMembersChange(updated as ApiChat);
      window.dispatchEvent(new CustomEvent("ping:chat-list-update"));
      toast({ title: "Участник исключён" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Не удалось исключить", variant: "destructive" });
    } finally {
      setRemoveLoadingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end bg-black/45"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-h-[70vh] overflow-hidden rounded-t-2xl border-t border-border bg-background shadow-2xl animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border/60 bg-background px-4 py-3">
          <p className="text-sm font-semibold">Участники ({members.length})</p>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:bg-secondary -mr-2"
            aria-label="Закрыть"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>
        <div className="overflow-y-auto max-h-[60vh] p-2 pb-[env(safe-area-inset-bottom,0px)]">
          {isAdmin && (
            <button
              type="button"
              onClick={openAddPicker}
              className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-primary hover:bg-primary/10 active:bg-primary/15 transition-colors"
            >
              <UserPlus className="h-5 w-5 shrink-0" />
              <span className="text-[15px] font-medium">Добавить участника</span>
            </button>
          )}
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-secondary/60 active:bg-secondary/80 transition-colors"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => {
                  onClose();
                  setLocation(
                    buildProfilePath({
                      publicId: m.publicId ?? 0,
                      userId: m.id,
                      fallbackPath: "/",
                    })
                  );
                }}
              >
                <UserAvatar
                  avatarUrl={m.avatarUrl ?? undefined}
                  displayName={memberName(m)}
                  seed={m.id}
                  size={44}
                  className="h-11 w-11 flex-shrink-0"
                />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                  {memberName(m)}
                  {m.id === currentUserId && (
                    <span className="ml-1 text-[12px] text-muted-foreground">(вы)</span>
                  )}
                </span>
              </button>
              {isAdmin && m.id !== currentUserId && (
                <button
                  type="button"
                  disabled={!!removeLoadingId}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(m.id);
                  }}
                  className="shrink-0 p-2 rounded-full text-destructive/90 hover:bg-destructive/15 active:bg-destructive/25 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center disabled:opacity-50"
                  aria-label={`Исключить ${memberName(m)}`}
                >
                  {removeLoadingId === m.id ? (
                    <span className="text-xs">…</span>
                  ) : (
                    <UserMinus className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {showAddPicker && (
        <div
          className="fixed inset-0 z-[210] flex items-end bg-black/45"
          onClick={() => setShowAddPicker(false)}
          role="presentation"
        >
          <div
            className="w-full max-h-[60vh] overflow-hidden rounded-t-2xl border-t border-border bg-background shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-border/60 bg-background px-4 py-3">
              <p className="text-sm font-semibold">Добавить участника</p>
              <button
                type="button"
                onClick={() => setShowAddPicker(false)}
                className="p-2 rounded-full text-muted-foreground hover:bg-secondary -mr-2"
                aria-label="Закрыть"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[50vh] p-2 pb-[env(safe-area-inset-bottom,0px)]">
              {contacts.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Нет контактов для добавления. Все контакты уже в группе.
                </p>
              ) : (
                contacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={addLoading}
                    onClick={() => handleAdd(c.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-secondary/60 active:bg-secondary/80 transition-colors disabled:opacity-50"
                  >
                    <UserAvatar
                      avatarUrl={c.avatarUrl ?? undefined}
                      displayName={contactDisplayName(c)}
                      seed={c.id}
                      size={44}
                      className="h-11 w-11 flex-shrink-0"
                    />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                      {contactDisplayName(c)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
