import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarCropModal } from "@/components/AvatarCropModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile, logout, uploadAvatar } from "@/lib/auth";
import { resolveUrl } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import type { Gender } from "@shared/schema";
import { NAME_MAX_LENGTH } from "@shared/schema";
import { FormError } from "@/components/ui/form-error";

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Мужской" },
  { value: "female", label: "Женский" },
  { value: "other", label: "Другое" },
];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { user, refetch } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [surname, setSurname] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [birthDate, setBirthDate] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarCropDataUrl, setAvatarCropDataUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAvatarFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarCropDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const clearAvatar = () => {
    setAvatarUrl("");
    setAvatarPreview(null);
  };

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!displayName.trim()) {
      setError("Введите имя");
      return;
    }
    if (!surname.trim()) {
      setError("Введите фамилию");
      return;
    }
    if (!gender) {
      setError("Укажите пол");
      return;
    }
    setLoading(true);
    try {
      await updateProfile({
        displayName: displayName.trim().slice(0, NAME_MAX_LENGTH),
        surname: surname.trim().slice(0, NAME_MAX_LENGTH),
        gender,
        birthDate: birthDate.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      });
      await refetch();
      setLocation("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    await refetch();
  };

  return (
    <div className="h-[100dvh] min-h-0 w-full max-w-full overflow-x-hidden overflow-y-hidden flex flex-col bg-background">
      <header className="shrink-0 flex items-center justify-end py-3 px-4 border-b border-border/30">
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 py-2 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors text-sm font-medium min-h-[var(--uix-touch-min)]"
          aria-label="Выйти из аккаунта"
        >
          <LogOut className="w-4 h-4" />
          Выйти
        </button>
      </header>
      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col items-center p-4 pb-[max(2rem,env(safe-area-inset-bottom,0px)+1rem)]"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
      <div className="w-full max-w-[340px] flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <img src="/logo.png?v=3" alt="" className="h-14 w-auto object-contain" />
        </div>
        <p className="text-muted-foreground text-center text-sm">
          Заполните профиль
        </p>

        <div className="w-full rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Ваш ID</p>
          <p className="text-2xl font-bold text-primary">{user.publicId}</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Имя *</Label>
            <Input
              id="displayName"
              type="text"
              placeholder="Имя"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full"
              maxLength={NAME_MAX_LENGTH}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="surname">Фамилия *</Label>
            <Input
              id="surname"
              type="text"
              placeholder="Фамилия"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              className="w-full"
              maxLength={NAME_MAX_LENGTH}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Пол *</Label>
            <Select value={gender || undefined} onValueChange={(v) => setGender((v && ["male", "female", "other"].includes(v) ? v : "") as Gender | "")} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите пол" />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="birthDate">Дата рождения (по желанию)</Label>
            <Input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label>Аватар (по желанию)</Label>
            <p className="text-xs text-muted-foreground">
              Загрузите фото с телефона или компьютера — оно отобразится в круге
            </p>
            <div className="flex items-center gap-4">
              {avatarPreview ? (
                <>
                  <div className="relative">
                    <img
                      src={resolveUrl(avatarPreview)}
                      alt=""
                      className="h-20 w-20 rounded-full object-cover border-2 border-border"
                    />
                    {uploadingAvatar && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white text-xs">
                        Загрузка…
                      </span>
                    )}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={clearAvatar} disabled={uploadingAvatar}>
                    Удалить
                  </Button>
                </>
              ) : null}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleAvatarFile}
                />
                <span className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background hover:bg-accent hover:text-accent-foreground">
                  {avatarPreview ? "Заменить фото" : "Выбрать фото"}
                </span>
              </label>
            </div>
          </div>
          {error && <FormError message={error} />}
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !displayName.trim() || !surname.trim() || !gender}
          >
            {loading ? "Сохранение..." : "Продолжить"}
          </Button>
        </form>
      </div>
      </div>

      {avatarCropDataUrl && (
        <AvatarCropModal
          imageDataUrl={avatarCropDataUrl}
          onConfirm={(cropped) => {
            setAvatarUrl(cropped);
            setAvatarPreview(cropped);
            setAvatarCropDataUrl(null);
            setUploadingAvatar(true);
            uploadAvatar(cropped)
              .then((url) => {
                setAvatarUrl(url);
                setAvatarPreview(url);
                toast({ title: "Аватар загружен" });
              })
              .catch(() => {
                toast({ title: "Ошибка загрузки аватара", variant: "destructive" });
              })
              .finally(() => setUploadingAvatar(false));
          }}
          onCancel={() => setAvatarCropDataUrl(null)}
        />
      )}
    </div>
  );
}
