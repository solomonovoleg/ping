import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, ImagePlus, Loader2, MessagesSquare, Users } from "lucide-react";
import { AdminPanelCard, adminSkeletonClass } from "@/features/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ListEmptyState, ErrorWithRetry } from "@/components/ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { TapScaleButton } from "@/components/ui/tap-scale";
import {
  createMediaStudioGroupChat,
  fetchMediaStudioGroupChats,
  fetchStudioSyntheticUsers,
  uploadMediaStudioGroupChatAvatar,
  type MediaStudioCreateGroupChatResult,
} from "./api";

const QK_GROUP_CHATS = ["admin", "media-studio", "group-chats"] as const;

function userLabel(displayName: string | null, surname: string | null): string {
  const value = [displayName, surname].filter(Boolean).join(" ").trim();
  return value || "Без имени";
}

export function GroupChatsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [creatorId, setCreatorId] = useState("");
  const [chatName, setChatName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarName, setAvatarName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<MediaStudioCreateGroupChatResult | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin", "media-studio", "synthetic-users", "for-group-chats"],
    queryFn: () => fetchStudioSyntheticUsers(200, 0),
  });

  const chatsQuery = useQuery({
    queryKey: QK_GROUP_CHATS,
    queryFn: fetchMediaStudioGroupChats,
  });

  const creators = useMemo(
    () =>
      (usersQuery.data?.users ?? []).map((u) => ({
        id: u.id,
        label: userLabel(u.displayName, u.surname),
        publicId: u.publicId,
      })),
    [usersQuery.data?.users],
  );

  const createMut = useMutation({
    mutationFn: async () => {
      if (!creatorId.trim()) throw new Error("Выберите создателя чата");
      const created = await createMediaStudioGroupChat({
        creatorUserId: creatorId,
        name: chatName.trim() || undefined,
      });
      if (avatarFile) {
        await uploadMediaStudioGroupChatAvatar(created.chat.id, avatarFile);
      }
      return created;
    },
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: QK_GROUP_CHATS });
      setLastCreated(created);
      setChatName("");
      setAvatarFile(null);
      setAvatarName("");
      toast({
        title: "Чат создан",
        description: avatarFile ? "Групповой чат создан, аватар загружен." : "Групповой чат создан.",
      });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    },
  });

  const copyInvite = async (chatId: string, inviteLink: string | null) => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedId(chatId);
      setTimeout(() => setCopiedId((prev) => (prev === chatId ? null : prev)), 1800);
      toast({ title: "Ссылка скопирована" });
    } catch {
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось скопировать ссылку" });
    }
  };

  return (
    <div className="space-y-4">
      <AdminPanelCard className="p-4 sm:p-6 space-y-4">
        <h3 className="text-sm font-semibold">Создать групповой чат</h3>
        {usersQuery.isLoading ? (
          <Skeleton className={adminSkeletonClass + " h-10 w-full"} />
        ) : creators.length === 0 ? (
          <p className="text-sm text-destructive/90">
            Нет синтетических пользователей. Сначала создайте их во вкладке «Пользователи».
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Создатель чата (studio user)</Label>
              <Select value={creatorId || undefined} onValueChange={setCreatorId}>
                <SelectTrigger className="min-h-[var(--uix-touch-min)]">
                  <SelectValue placeholder="Кто создаёт чат" />
                </SelectTrigger>
                <SelectContent>
                  {creators.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label} · ID {c.publicId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ms-group-name">Название (необязательно)</Label>
              <Input
                id="ms-group-name"
                value={chatName}
                onChange={(e) => setChatName(e.target.value)}
                placeholder="Например: Контент-команда"
                maxLength={120}
                className="min-h-[var(--uix-touch-min)]"
              />
            </div>

            <div className="space-y-2">
              <Label>Аватар чата (необязательно)</Label>
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setAvatarFile(file);
                  setAvatarName(file?.name ?? "");
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 min-h-[var(--uix-touch-min)]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  {avatarFile ? "Сменить аватар" : "Выбрать аватар"}
                </Button>
                <span className="text-xs text-muted-foreground">{avatarName || "Файл не выбран"}</span>
              </div>
            </div>

            <Button
              type="button"
              className="min-h-[var(--uix-touch-min)]"
              disabled={createMut.isPending || creators.length === 0 || !creatorId}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Создать чат"}
            </Button>
          </>
        )}
      </AdminPanelCard>

      {lastCreated ? (
        <AdminPanelCard className="p-4 sm:p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Check className="h-4 w-4 text-emerald-500" />
            Чат создан: {lastCreated.chat.name?.trim() || "Без названия"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={lastCreated.inviteLink} readOnly className="font-mono text-xs sm:max-w-xl" />
            <TapScaleButton
              type="button"
              haptic
              subtle
              onClick={() => void copyInvite(lastCreated.chat.id, lastCreated.inviteLink)}
              className="min-h-[var(--uix-touch-min)] rounded-md border px-3 text-xs"
              aria-label="Скопировать приглашение"
            >
              <Copy className="h-3.5 w-3.5" />
            </TapScaleButton>
          </div>
        </AdminPanelCard>
      ) : null}

      <AdminPanelCard className="p-4 sm:p-6 overflow-x-auto">
        <h3 className="text-sm font-semibold mb-3">Созданные групповые чаты</h3>
        {chatsQuery.isLoading ? (
          <div className={adminSkeletonClass + " space-y-2"}>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : chatsQuery.isError ? (
          <ErrorWithRetry
            title="Не удалось загрузить список чатов"
            description={(chatsQuery.error as Error)?.message}
            onRetry={() => void chatsQuery.refetch()}
          />
        ) : (chatsQuery.data?.chats ?? []).length === 0 ? (
          <ListEmptyState
            icon={MessagesSquare}
            title="Групповых чатов пока нет"
            description="Создайте первый чат в форме выше: выберите студийного пользователя и получите инвайт-ссылку."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Чат</TableHead>
                <TableHead>Участники</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Ссылка</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(chatsQuery.data?.chats ?? []).map((chat) => (
                <TableRow key={chat.id}>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      {chat.avatarUrl ? (
                        <img src={chat.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <Users className="h-4 w-4" />
                        </span>
                      )}
                      <span className="max-w-[240px] truncate">{chat.name || "Без названия"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{chat.memberCount}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(chat.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {chat.inviteLink ? (
                      <div className="flex items-center gap-1">
                        <TapScaleButton
                          type="button"
                          haptic
                          subtle
                          className="min-h-[var(--uix-touch-min)] rounded-md border px-2 text-xs"
                          onClick={() => void copyInvite(chat.id, chat.inviteLink)}
                          aria-label="Скопировать ссылку"
                        >
                          {copiedId === chat.id ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </TapScaleButton>
                        <a
                          href={chat.inviteLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                        >
                          Открыть
                          <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
                        </a>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminPanelCard>
    </div>
  );
}
