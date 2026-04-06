import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminCreateGroupChat,
  adminUploadGroupChatAvatar,
  adminListGroupChats,
  fetchAdminUsers,
  type AdminGroupChat,
  type AdminCreateGroupChatResult,
  type AdminUser,
} from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Copy,
  Check,
  ImagePlus,
  Users,
  Link2,
  Search,
  MessageSquarePlus,
  ExternalLink,
} from "lucide-react";

type CreationResult = AdminCreateGroupChatResult & { avatarUrl?: string };

export default function AdminGroupChats() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [chatName, setChatName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [creatorSearch, setCreatorSearch] = useState("");
  const [selectedCreator, setSelectedCreator] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [lastResult, setLastResult] = useState<CreationResult | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: chatsData, isLoading: chatsLoading } = useQuery({
    queryKey: ["admin", "group-chats"],
    queryFn: adminListGroupChats,
  });

  const { data: usersData, isFetching: usersSearching } = useQuery({
    queryKey: ["admin", "users-search", creatorSearch],
    queryFn: () => fetchAdminUsers({ search: creatorSearch, limit: 10 }),
    enabled: creatorSearch.length >= 2,
    staleTime: 5000,
  });

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleCreate = async () => {
    if (!selectedCreator) {
      toast({ title: "Выберите создателя чата", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const result = await adminCreateGroupChat({
        creatorUserId: selectedCreator.id,
        name: chatName.trim() || undefined,
      });

      let finalAvatarUrl: string | undefined;
      if (avatarFile) {
        try {
          const { url } = await adminUploadGroupChatAvatar(result.chat.id, avatarFile);
          finalAvatarUrl = url;
        } catch (e) {
          toast({
            title: "Чат создан, но аватар не загрузился",
            description: e instanceof Error ? e.message : "Ошибка загрузки аватара",
            variant: "destructive",
          });
        }
      }

      setLastResult({ ...result, avatarUrl: finalAvatarUrl });
      queryClient.invalidateQueries({ queryKey: ["admin", "group-chats"] });
      toast({ title: "Групповой чат создан" });
    } catch (e) {
      toast({
        title: "Ошибка",
        description: e instanceof Error ? e.message : "Не удалось создать чат",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setChatName("");
    setAvatarFile(null);
    setAvatarPreview(null);
    setSelectedCreator(null);
    setCreatorSearch("");
    setLastResult(null);
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast({ title: "Ссылка скопирована" });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[hsl(210_20%_98%)]">Групповые чаты</h1>
          <p className="text-sm text-[hsl(var(--admin-muted))]">
            Создание групповых чатов с приглашениями по ссылке
          </p>
        </div>
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Создать чат
          </Button>
        )}
      </div>

      {showForm && (
        <div className="admin-surface-card rounded-xl border border-[hsl(var(--admin-border)/0.35)] p-6 space-y-5">
          {lastResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-[hsl(210_20%_98%)]">
                    Чат «{lastResult.chat.name || "Без названия"}» создан
                  </p>
                  <p className="text-sm text-[hsl(var(--admin-muted))]">
                    Создатель: {lastResult.creator.displayName || `ID ${lastResult.creator.publicId}`}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[hsl(var(--admin-muted))]">Ссылка-приглашение</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={lastResult.inviteLink}
                    className="flex-1 font-mono text-sm"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyLink(lastResult.inviteLink)}
                    className="shrink-0"
                    aria-label="Скопировать ссылку"
                  >
                    {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-[hsl(var(--admin-muted))]">
                  Любой, кто перейдёт по этой ссылке, попадёт в чат — даже без регистрации.
                </p>
              </div>

              <Button variant="outline" onClick={resetForm}>
                Готово
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-[hsl(210_20%_98%)] flex items-center gap-2">
                <MessageSquarePlus className="h-5 w-5" />
                Новый групповой чат
              </h2>

              <div className="space-y-2">
                <Label htmlFor="chat-name">Название чата</Label>
                <Input
                  id="chat-name"
                  placeholder="Например: Общий чат"
                  value={chatName}
                  onChange={(e) => setChatName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Аватар чата</Label>
                <div className="flex items-center gap-4">
                  {avatarPreview ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-[hsl(var(--admin-accent)/0.4)] transition-transform hover:scale-105"
                    >
                      <img
                        src={avatarPreview}
                        alt="Аватар чата"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-[hsl(var(--admin-border)/0.5)] text-[hsl(var(--admin-muted))] transition-colors hover:border-[hsl(var(--admin-accent)/0.5)] hover:text-[hsl(var(--admin-accent))]"
                      aria-label="Загрузить аватар"
                    >
                      <ImagePlus className="h-6 w-6" />
                    </button>
                  )}
                  <div className="text-sm text-[hsl(var(--admin-muted))]">
                    {avatarFile ? avatarFile.name : "JPEG, PNG, WebP — до 5 МБ"}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <div className="space-y-2">
                <Label>Создатель чата (пользователь)</Label>
                {selectedCreator ? (
                  <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--admin-border)/0.35)] bg-[hsl(var(--admin-elevated)/0.3)] p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--admin-accent)/0.25)] text-sm font-semibold text-[hsl(var(--admin-accent))]">
                      {selectedCreator.displayName?.[0]?.toUpperCase() || "#"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-[hsl(210_20%_98%)]">
                        {selectedCreator.displayName || "—"}{" "}
                        {selectedCreator.surname || ""}
                      </p>
                      <p className="text-xs text-[hsl(var(--admin-muted))]">
                        ID {selectedCreator.publicId}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCreator(null);
                        setCreatorSearch("");
                      }}
                    >
                      Сменить
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--admin-muted))]" />
                      <Input
                        placeholder="Поиск по имени, ID или телефону..."
                        value={creatorSearch}
                        onChange={(e) => setCreatorSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {usersSearching && (
                      <p className="text-xs text-[hsl(var(--admin-muted))]">Поиск…</p>
                    )}
                    {usersData?.users && usersData.users.length > 0 && (
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-[hsl(var(--admin-border)/0.35)] bg-[hsl(var(--admin-elevated)/0.2)]">
                        {usersData.users.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setSelectedCreator(u);
                              setCreatorSearch("");
                            }}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[hsl(var(--admin-elevated)/0.4)]"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--admin-accent)/0.2)] text-xs font-semibold text-[hsl(var(--admin-accent))]">
                              {u.displayName?.[0]?.toUpperCase() || "#"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm text-[hsl(210_20%_98%)]">
                                {u.displayName || "—"} {u.surname || ""}
                              </p>
                              <p className="text-xs text-[hsl(var(--admin-muted))]">
                                ID {u.publicId}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {creatorSearch.length >= 2 &&
                      !usersSearching &&
                      usersData?.users &&
                      usersData.users.length === 0 && (
                        <p className="text-xs text-[hsl(var(--admin-muted))]">
                          Никого не найдено
                        </p>
                      )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleCreate} disabled={creating || !selectedCreator}>
                  {creating ? "Создание…" : "Создать чат"}
                </Button>
                <Button variant="ghost" onClick={resetForm}>
                  Отмена
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* List of existing group chats */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[hsl(var(--admin-muted))]">
          Существующие групповые чаты
        </h2>

        {chatsLoading && (
          <div className="admin-surface-card rounded-xl border border-[hsl(var(--admin-border)/0.35)] p-6 text-center text-sm text-[hsl(var(--admin-muted))]">
            Загрузка…
          </div>
        )}

        {!chatsLoading && (!chatsData?.chats || chatsData.chats.length === 0) && (
          <div className="admin-surface-card rounded-xl border border-[hsl(var(--admin-border)/0.35)] p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-[hsl(var(--admin-muted))]" />
            <p className="mt-2 text-sm text-[hsl(var(--admin-muted))]">
              Групповых чатов пока нет
            </p>
          </div>
        )}

        {chatsData?.chats && chatsData.chats.length > 0 && (
          <div className="space-y-2">
            {chatsData.chats.map((chat) => (
              <GroupChatRow key={chat.id} chat={chat} onCopyLink={copyLink} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GroupChatRow({
  chat,
  onCopyLink,
}: {
  chat: AdminGroupChat;
  onCopyLink: (link: string) => void;
}) {
  const fullLink = chat.inviteCode
    ? `${window.location.origin}/invite/${chat.inviteCode}`
    : null;

  return (
    <div className="admin-surface-card flex items-center gap-4 rounded-xl border border-[hsl(var(--admin-border)/0.35)] px-4 py-3">
      {chat.avatarUrl ? (
        <img
          src={chat.avatarUrl}
          alt={chat.name || "Чат"}
          className="h-10 w-10 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--admin-accent)/0.2)] text-[hsl(var(--admin-accent))]">
          <Users className="h-5 w-5" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-[hsl(210_20%_98%)]">
          {chat.name || "Без названия"}
        </p>
        <p className="text-xs text-[hsl(var(--admin-muted))]">
          {new Date(chat.createdAt).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>

      {fullLink && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCopyLink(fullLink)}
            className="gap-1.5 text-xs"
          >
            <Link2 className="h-3.5 w-3.5" />
            Ссылка
          </Button>
          <a
            href={fullLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--admin-muted))] transition-colors hover:bg-[hsl(var(--admin-elevated)/0.4)] hover:text-[hsl(210_20%_96%)]"
            aria-label="Открыть ссылку"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}
