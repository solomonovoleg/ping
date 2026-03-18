import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile, uploadAvatar, uploadCover } from "@/lib/auth";
import { resolveUrl } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import { AvatarCropModal } from "@/components/AvatarCropModal";
import { LoadingProgress } from "@/components/ui/loading-progress";
import type { Gender } from "@shared/schema";
import { NAME_MAX_LENGTH } from "@shared/schema";

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Мужской" },
  { value: "female", label: "Женский" },
  { value: "other", label: "Другое" },
];

export default function EditProfile() {
  const [, setLocation] = useLocation();
  const { user, refetch, setUserFromLogin } = useAuth();
  const { toast } = useToast();

  const [editDisplayName, setEditDisplayName] = useState("");
  const [editSurname, setEditSurname] = useState("");
  const [editGender, setEditGender] = useState<Gender | "">("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [editBio, setEditBio] = useState("");
  const [editProfileLink, setEditProfileLink] = useState("");
  const [editCoverUrl, setEditCoverUrl] = useState("");
  const [avatarCropDataUrl, setAvatarCropDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverImageError, setCoverImageError] = useState(false);
  const [avatarImageError, setAvatarImageError] = useState(false);
  const [error, setError] = useState("");

  const isLikelyImageFile = useCallback((file: File): boolean => {
    if (file.type && file.type.startsWith("image/")) return true;
    return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name || "");
  }, []);

  useEffect(() => {
    if (!user) return;
    setEditDisplayName((user.displayName ?? "").slice(0, NAME_MAX_LENGTH));
    setEditSurname((user.surname ?? "").slice(0, NAME_MAX_LENGTH));
    setEditGender((user.gender as Gender) ?? "");
    setEditBirthDate(user.birthDate ?? "");
    setEditAvatarUrl(user.avatarUrl ?? "");
    setEditAvatarPreview(user.avatarUrl ? user.avatarUrl : null);
    setEditBio((user as { bio?: string | null }).bio ?? "");
    setEditProfileLink((user as { profileLink?: string | null }).profileLink ?? "");
    setEditCoverUrl((user as { coverUrl?: string | null }).coverUrl ?? "");
    setCoverImageError(false);
    setAvatarImageError(false);
  }, [user]);

  const handleEditAvatarFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarCropDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const clearEditAvatar = useCallback(() => {
    setEditAvatarUrl("");
    setEditAvatarPreview(null);
    setAvatarImageError(false);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      if (!editDisplayName.trim()) {
        setError("Введите имя");
        return;
      }
      if (!editSurname.trim()) {
        setError("Введите фамилию");
        return;
      }
      if (!editGender) {
        setError("Укажите пол");
        return;
      }
      setSaving(true);
      try {
        const updated = await updateProfile({
          displayName: editDisplayName.trim().slice(0, NAME_MAX_LENGTH),
          surname: editSurname.trim().slice(0, NAME_MAX_LENGTH),
          gender: editGender || undefined,
          birthDate: editBirthDate.trim() ? editBirthDate.trim() : null,
          avatarUrl: editAvatarUrl.trim() || undefined,
          bio: editBio.trim() || null,
          profileLink: editProfileLink.trim() || null,
          coverUrl: editCoverUrl.trim() || null,
        });
        setUserFromLogin(updated);
        refetch().catch(() => {});
        toast({ title: "Профиль сохранён" });
        setLocation("/profile/me");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Ошибка сохранения";
        const displayMsg = msg.includes("401") || msg.includes("Unauthorized") ? "Сессия истекла. Войдите снова." : msg;
        setError(displayMsg);
        toast({ title: displayMsg, variant: "destructive" });
      } finally {
        setSaving(false);
      }
    },
    [editDisplayName, editSurname, editGender, editBirthDate, editAvatarUrl, editBio, editProfileLink, editCoverUrl, setUserFromLogin, refetch, toast, setLocation]
  );

  const handleCoverFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isLikelyImageFile(file)) {
      toast({
        title: "Неподдерживаемый файл",
        description: "Выберите изображение (JPG, PNG, WebP, HEIC/HEIF).",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    setUploadingCover(true);
    uploadCover(file)
      .then((url) => {
        setEditCoverUrl(url);
        setCoverImageError(false);
        toast({ title: "Шапка загружена" });
      })
      .catch((err) => {
        setCoverImageError(true);
        const msg = err instanceof Error ? err.message : "Проверьте интернет и попробуйте снова";
        toast({ title: "Ошибка загрузки шапки", description: msg, variant: "destructive" });
      })
      .finally(() => {
        setUploadingCover(false);
        e.target.value = "";
      });
  }, [isLikelyImageFile, toast]);

  if (!user) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="shrink-0 flex items-center gap-2 px-2 py-3 border-b border-border/50 bg-background">
          <div className="w-10 h-10 rounded-full bg-muted" />
          <div className="h-5 w-24 bg-muted rounded" />
        </div>
        <LoadingProgress loading minHeight="200px" className="flex-1">
          <div className="min-h-[200px]" />
        </LoadingProgress>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100vh] bg-background w-full max-w-full overflow-x-hidden">
      {/* Шапка: фиксированная */}
      <div className="shrink-0 flex items-center gap-2 px-2 py-3 border-b border-border/50 bg-background min-w-0">
        <TapScaleButton
          type="button"
          onClick={() => setLocation("/profile/me")}
          haptic
          subtle
          className="p-2 -ml-2 rounded-full text-primary hover:bg-primary/10 transition-colors shrink-0 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
          aria-label="Назад в профиль"
        >
          <ChevronLeft className="w-6 h-6" />
        </TapScaleButton>
        <h1 className="text-lg font-semibold truncate min-w-0">Редактировать профиль</h1>
      </div>

      {/* Форма: скроллируется вместе со страницей, без горизонтального скролла */}
      <div className="flex-1 w-full min-w-0">
        <form onSubmit={handleSubmit} className="p-0 pb-8 w-full min-w-0 box-border">
          {/* Блок шапки — от края до края без отступов */}
          <div className="w-[100vw] max-w-none ml-[calc(-50vw+50%)] mb-5">
            <div className="space-y-2 px-4">
              <Label>Шапка профиля</Label>
              <p className="text-sm text-muted-foreground">Большое изображение сверху страницы профиля</p>
            </div>
            {editCoverUrl && !coverImageError ? (
              <div className="relative overflow-hidden border-y border-border bg-muted/30 w-full">
                <img
                  src={resolveUrl(editCoverUrl)}
                  alt=""
                  className="w-full h-36 sm:h-40 object-cover block"
                  onError={() => setCoverImageError(true)}
                />
                {uploadingCover && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm">Загрузка…</div>
                )}
                <div className="absolute bottom-2 right-4 flex gap-2">
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="sr-only" onChange={handleCoverFile} disabled={uploadingCover} />
                    <span className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">Заменить</span>
                  </label>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setEditCoverUrl(""); setCoverImageError(false); }} disabled={uploadingCover}>
                    Удалить
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {coverImageError ? (
                  <div className="px-4 space-y-2">
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                      Не удалось загрузить изображение. Замените файл или удалите.
                    </div>
                    <div className="flex gap-2">
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" className="sr-only" onChange={handleCoverFile} disabled={uploadingCover} />
                        <span className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">Заменить</span>
                      </label>
                      <Button type="button" variant="outline" size="sm" onClick={() => { setEditCoverUrl(""); setCoverImageError(false); }} disabled={uploadingCover}>Удалить</Button>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 h-24 w-full hover:bg-muted/30 transition-colors min-w-0">
                    <input type="file" accept="image/*" className="sr-only" onChange={handleCoverFile} disabled={uploadingCover} />
                    <span className="text-sm text-muted-foreground">{uploadingCover ? "Загрузка…" : "Выбрать изображение для шапки"}</span>
                  </label>
                )}
              </>
            )}
          </div>

          <div className="px-4 space-y-5 max-w-[480px] mx-auto">
          <div className="flex flex-col items-center gap-3">
            <Label>Аватар</Label>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {editAvatarPreview ? (
                <>
                  <div className="relative">
                    {avatarImageError ? (
                      <div className="h-20 w-20 rounded-full border-2 border-destructive/50 bg-destructive/10 flex items-center justify-center text-destructive text-xs text-center px-1">Ошибка загрузки</div>
                    ) : (
                    <img
                      src={resolveUrl(editAvatarPreview)}
                      alt=""
                      className="h-20 w-20 rounded-full object-cover border-2 border-border"
                      onError={() => setAvatarImageError(true)}
                    />
                    )}
                    {uploadingAvatar && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white text-xs">
                        Загрузка…
                      </span>
                    )}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={clearEditAvatar} disabled={uploadingAvatar}>
                    Удалить
                  </Button>
                </>
              ) : null}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleEditAvatarFile}
                />
                <span className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
                  {editAvatarPreview ? "Заменить фото" : "Выбрать фото"}
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editDisplayName">Имя *</Label>
            <Input
              id="editDisplayName"
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              placeholder="Имя"
              maxLength={NAME_MAX_LENGTH}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editSurname">Фамилия *</Label>
            <Input
              id="editSurname"
              value={editSurname}
              onChange={(e) => setEditSurname(e.target.value)}
              placeholder="Фамилия"
              maxLength={NAME_MAX_LENGTH}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Пол *</Label>
            <Select value={editGender || undefined} onValueChange={(v) => setEditGender((v && ["male", "female", "other"].includes(v) ? v : "") as Gender | "")} required>
              <SelectTrigger>
                <SelectValue placeholder="Выберите пол" />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editBirthDate">Дата рождения (по желанию)</Label>
            <Input
              id="editBirthDate"
              type="date"
              value={editBirthDate}
              onChange={(e) => setEditBirthDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editBio">О себе (био)</Label>
            <p className="text-sm text-muted-foreground">Краткое описание: чем занимаетесь, интересы</p>
            <textarea
              id="editBio"
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="Кратко о себе..."
              rows={4}
              className="flex w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none box-border max-w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editProfileLink">Ссылка (блог, магазин)</Label>
            <p className="text-sm text-muted-foreground">URL будет отображаться в профиле</p>
            <Input
              id="editProfileLink"
              type="url"
              value={editProfileLink}
              onChange={(e) => setEditProfileLink(e.target.value)}
              placeholder="https://..."
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setLocation("/profile/me")}
            >
              Отмена
            </Button>
            <TapScaleButton
              type="submit"
              haptic
              className="flex-1 rounded-lg min-h-9 px-4 py-2 bg-primary text-primary-foreground border border-primary-border font-medium text-sm disabled:opacity-50 disabled:pointer-events-none"
              disabled={saving}
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </TapScaleButton>
          </div>
          </div>
        </form>
      </div>

      {avatarCropDataUrl && (
        <AvatarCropModal
          imageDataUrl={avatarCropDataUrl}
          onConfirm={(cropped) => {
            setEditAvatarUrl(cropped);
            setEditAvatarPreview(cropped);
            setAvatarCropDataUrl(null);
            setUploadingAvatar(true);
            uploadAvatar(cropped)
              .then((url) => {
                setEditAvatarUrl(url);
                setEditAvatarPreview(url);
                setAvatarImageError(false);
                toast({ title: "Аватар загружен" });
              })
              .catch((err) => {
                toast({ title: "Ошибка загрузки аватара", description: err?.message ?? "Проверьте интернет и попробуйте снова", variant: "destructive" });
              })
              .finally(() => setUploadingAvatar(false));
          }}
          onCancel={() => setAvatarCropDataUrl(null)}
        />
      )}
    </div>
  );
}
