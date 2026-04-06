import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, ImagePlus, ExternalLink, Loader2 } from "lucide-react";
import { AdminPanelCard, adminDialogSurfaceClass, adminSkeletonClass } from "@/features/admin-shell";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ListEmptyState, ErrorWithRetry } from "@/components/ui/empty";
import { useToast } from "@/hooks/use-toast";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { resolveUrl } from "@/lib/api-base";
import { NAME_MAX_LENGTH, NICKNAME_MAX_LENGTH } from "@shared/schema";
import {
  createStudioSyntheticUser,
  fetchStudioSyntheticUserDetail,
  fetchStudioSyntheticUsers,
  patchStudioSyntheticUser,
  uploadStudioSyntheticAvatar,
  uploadStudioSyntheticCover,
} from "./api";

const GENDERS = [
  { value: "male", label: "Мужской" },
  { value: "female", label: "Женский" },
  { value: "other", label: "Другой" },
];

const QK_LIST = ["admin", "media-studio", "synthetic-users"] as const;

function DropTarget({
  label,
  hint,
  busy,
  onPick,
}: {
  label: string;
  hint: string;
  busy: boolean;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) onPick(f);
    },
    [onPick],
  );
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <button
        type="button"
        disabled={busy}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className="w-full min-h-[var(--uix-touch-min)] rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-left text-sm text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
      >
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Загрузка…
          </span>
        ) : (
          <>
            <ImagePlus className="inline h-4 w-4 mr-2 align-text-bottom opacity-70" aria-hidden />
            {hint}
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.heic,.heif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = "";
          }}
        />
      </button>
    </div>
  );
}

function UserDetailDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "media-studio", "user", userId],
    queryFn: () => fetchStudioSyntheticUserDetail(userId!),
    enabled: open && !!userId,
  });

  const [displayName, setDisplayName] = useState("");
  const [surname, setSurname] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("");
  const [nickname, setNickname] = useState("");
  const [profileLink, setProfileLink] = useState("");

  useEffect(() => {
    const d = q.data;
    if (!d) return;
    setDisplayName(d.user.displayName ?? "");
    setSurname(d.user.surname ?? "");
    setBio(d.user.bio ?? "");
    setCity(d.user.city ?? "");
    setStatus(d.user.status ?? "");
    setNickname(d.user.nickname ?? "");
    setProfileLink(d.user.profileLink ?? "");
  }, [q.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const fn = displayName.trim().slice(0, NAME_MAX_LENGTH);
      const sn = surname.trim().slice(0, NAME_MAX_LENGTH);
      if (!fn || !sn) {
        throw new Error("Имя и фамилия не могут быть пустыми");
      }
      return patchStudioSyntheticUser(userId!, {
        displayName: fn,
        surname: sn,
        bio: bio.trim() || null,
        city: city.trim() || null,
        status: status.trim() || null,
        nickname: nickname.trim() || null,
        profileLink: profileLink.trim() || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Профиль сохранён" });
      void qc.invalidateQueries({ queryKey: ["admin", "media-studio", "user", userId] });
      void qc.invalidateQueries({ queryKey: QK_LIST });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Ошибка", description: e.message }),
  });

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);

  const onAvatar = async (file: File) => {
    if (!userId) return;
    setAvatarBusy(true);
    try {
      await uploadStudioSyntheticAvatar(userId, file);
      toast({ title: "Аватар обновлён" });
      void qc.invalidateQueries({ queryKey: ["admin", "media-studio", "user", userId] });
      void qc.invalidateQueries({ queryKey: QK_LIST });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Аватар",
        description: e instanceof Error ? e.message : "Ошибка",
      });
    } finally {
      setAvatarBusy(false);
    }
  };

  const onCover = async (file: File) => {
    if (!userId) return;
    setCoverBusy(true);
    try {
      await uploadStudioSyntheticCover(userId, file);
      toast({ title: "Обложка обновлена" });
      void qc.invalidateQueries({ queryKey: ["admin", "media-studio", "user", userId] });
      void qc.invalidateQueries({ queryKey: QK_LIST });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Обложка",
        description: e instanceof Error ? e.message : "Ошибка",
      });
    } finally {
      setCoverBusy(false);
    }
  };

  const profileUrl =
    typeof window !== "undefined" && q.data?.user.publicId != null
      ? `${window.location.origin}/profile/${q.data.user.publicId}`
      : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-lg max-h-[90dvh] overflow-y-auto", adminDialogSurfaceClass)}>
        <DialogHeader>
          <DialogTitle>Studio user</DialogTitle>
          <DialogDescription>
            Профиль ведёт себя как обычный аккаунт в ленте. Вход по телефону недоступен.
          </DialogDescription>
        </DialogHeader>
        {q.isLoading ? (
          <div className="space-y-2 py-4">
            <Skeleton className={cn("h-8 w-full", adminSkeletonClass)} />
            <Skeleton className={cn("h-24 w-full", adminSkeletonClass)} />
          </div>
        ) : q.isError ? (
          <ErrorWithRetry
            title="Не удалось загрузить карточку"
            onRetry={() => void q.refetch()}
          />
        ) : q.data ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {q.data.user.avatarUrl ? (
                <div className="flex items-center gap-3">
                  <img
                    src={resolveUrl(q.data.user.avatarUrl)}
                    alt=""
                    className="h-16 w-16 rounded-full object-cover border border-border/60 bg-muted"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className="text-xs text-muted-foreground">Текущий аватар</span>
                </div>
              ) : null}
              {q.data.user.coverUrl ? (
                <div className="space-y-1">
                  <img
                    src={resolveUrl(q.data.user.coverUrl)}
                    alt=""
                    className="h-16 w-full rounded-md object-cover border border-border/60 bg-muted"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className="text-xs text-muted-foreground">Обложка</span>
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border bg-muted/20 p-3 space-y-1 font-mono text-xs">
              <div>
                <span className="text-muted-foreground">UUID</span> {q.data.user.id}
              </div>
              <div>
                <span className="text-muted-foreground">public_id</span> {q.data.user.publicId}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="text-muted-foreground">Просмотры профиля:</span>
                <span>{q.data.profileViewsTotal} всего</span>
                <span className="text-muted-foreground">·</span>
                <span>{q.data.profileViewsUniqueViewers} уникальных зрителей</span>
                <span className="text-muted-foreground">·</span>
                <span>{q.data.postsCount} постов</span>
              </div>
              {profileUrl ? (
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline pt-1 min-h-[var(--uix-touch-min)]"
                >
                  Открыть профиль <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="st-fn">Имя</Label>
                <Input
                  id="st-fn"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, NAME_MAX_LENGTH))}
                  maxLength={NAME_MAX_LENGTH}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-sn">Фамилия</Label>
                <Input
                  id="st-sn"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value.slice(0, NAME_MAX_LENGTH))}
                  maxLength={NAME_MAX_LENGTH}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DropTarget
                label="Аватар"
                hint="Перетащите фото или нажмите (JPEG, PNG, WebP, HEIC…)"
                busy={avatarBusy}
                onPick={onAvatar}
              />
              <DropTarget
                label="Обложка"
                hint="Перетащите изображение или нажмите"
                busy={coverBusy}
                onPick={onCover}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="st-nick">Ник (@в шапке)</Label>
              <Input
                id="st-nick"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={NICKNAME_MAX_LENGTH}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="st-city">Город</Label>
              <Input id="st-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="st-status">Статус</Label>
              <Input id="st-status" value={status} onChange={(e) => setStatus(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="st-bio">О себе</Label>
              <Textarea id="st-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={2000} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="st-link">Ссылка в профиле</Label>
              <Input
                id="st-link"
                value={profileLink}
                onChange={(e) => setProfileLink(e.target.value)}
                maxLength={500}
              />
            </div>

            <TapScaleButton
              type="button"
              haptic
              className="min-h-[var(--uix-touch-min)]"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Сохранение…" : "Сохранить текст профиля"}
            </TapScaleButton>

            <div className="border-t pt-3">
              <h4 className="font-medium mb-2">Последние посты</h4>
              {q.data.recentPosts.length === 0 ? (
                <p className="text-muted-foreground text-xs">Пока нет опубликованных постов</p>
              ) : (
                <ul className="space-y-2 max-h-48 overflow-y-auto text-xs">
                  {q.data.recentPosts.map((p) => (
                    <li key={p.id} className="border-b border-border/50 pb-2">
                      <div className="text-muted-foreground">
                        {new Date(p.createdAt).toLocaleString("ru-RU")}
                      </div>
                      <div className="whitespace-pre-wrap break-words">{p.text}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function SyntheticUsersSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const listQ = useQuery({ queryKey: QK_LIST, queryFn: () => fetchStudioSyntheticUsers(100, 0) });

  const [createOpen, setCreateOpen] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [surname, setSurname] = useState("");
  const [gender, setGender] = useState("male");
  const [birthDate, setBirthDate] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      createStudioSyntheticUser({
        displayName: displayName.trim(),
        surname: surname.trim(),
        gender,
        birthDate: birthDate.trim() || null,
      }),
    onSuccess: (data) => {
      toast({ title: "Пользователь создан" });
      setDisplayName("");
      setSurname("");
      setBirthDate("");
      void qc.invalidateQueries({ queryKey: QK_LIST });
      setDetailId(data.user.id);
      setDetailOpen(true);
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Ошибка", description: e.message }),
  });

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = (id: string) => {
    setDetailId(id);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <AdminPanelCard className="p-5 sm:p-6">
        <div className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Новый studio user</h2>
              <p className="text-sm admin-text-muted">Имя, фамилия, пол; вход по SMS невозможен (служебный телефон)</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen((v) => !v)}>
              {createOpen ? "Свернуть" : "Развернуть"}
            </Button>
          </div>
        </div>
        {createOpen ? (
          <div className="max-w-xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="su-fn">Имя ({NAME_MAX_LENGTH} симв.)</Label>
                <Input
                  id="su-fn"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, NAME_MAX_LENGTH))}
                  maxLength={NAME_MAX_LENGTH}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-sn">Фамилия ({NAME_MAX_LENGTH} симв.)</Label>
                <Input
                  id="su-sn"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value.slice(0, NAME_MAX_LENGTH))}
                  maxLength={NAME_MAX_LENGTH}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Пол</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="min-h-[var(--uix-touch-min)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="su-bd">Дата рождения (необязательно)</Label>
              <Input id="su-bd" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <TapScaleButton
              type="button"
              haptic
              className="min-h-[var(--uix-touch-min)]"
              disabled={createMut.isPending || !displayName.trim() || !surname.trim()}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Создание…" : "Создать пользователя"}
            </TapScaleButton>
          </div>
        ) : null}
      </AdminPanelCard>

      <AdminPanelCard className="p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[hsl(210_20%_98%)]">
            <Users className="h-4 w-4" aria-hidden />
            Список studio users
          </h2>
          <p className="mt-1 text-sm admin-text-muted">Нажмите строку — карточка, посты, медиа профиля</p>
        </div>
        <div>
          {listQ.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : listQ.isError ? (
            <ErrorWithRetry title="Не удалось загрузить список" onRetry={() => void listQ.refetch()} />
          ) : !listQ.data?.users.length ? (
            <ListEmptyState
              icon={Users}
              title="Пока никого"
              description="Создайте первого пользователя формой выше — он появится в ленте как обычный аккаунт."
            />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Имя</TableHead>
                    <TableHead className="hidden sm:table-cell">Пол</TableHead>
                    <TableHead className="hidden md:table-cell">Создан</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listQ.data.users.map((u) => (
                    <TableRow
                      key={u.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => openDetail(u.id)}
                    >
                      <TableCell className="font-mono text-xs">{u.publicId}</TableCell>
                      <TableCell>
                        {[u.displayName, u.surname].filter(Boolean).join(" ") || "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {GENDERS.find((g) => g.value === u.gender)?.label ?? u.gender ?? "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {u.createdAt ? new Date(u.createdAt).toLocaleString("ru-RU") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </AdminPanelCard>

      <UserDetailDialog
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setDetailId(null);
        }}
        userId={detailId}
      />
    </div>
  );
}
