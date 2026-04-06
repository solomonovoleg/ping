import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile, uploadAvatar, uploadCover, normalizeGenderFromApi } from "@/lib/auth";
import { resolveUrl } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import { AvatarCropModal } from "@/components/AvatarCropModal";
import { ProfileCoverAdjustModal } from "@/components/ProfileCoverAdjustModal";
import { LoadingProgress } from "@/components/ui/loading-progress";
import { UploadProgressPanel } from "@/components/ui/upload-progress-panel";
import type { Gender } from "@shared/schema";
import { NAME_MAX_LENGTH, NICKNAME_MAX_LENGTH } from "@shared/schema";
import { CitySuggestInput } from "@/components/CitySuggestInput";
import { UserAvatar } from "@/components/UserAvatar";
import {
  PULSE_PROFILE_AVATAR_INNER_PX,
  PULSE_PROFILE_AVATAR_SQUIRCLE_INNER_RX,
} from "@/features/profile/pulse-profile";
import { fetchImageAsDataUrl } from "@/lib/profile-cover-editor";
import { uploadPostMedia, type PostVideoTrimUpload } from "@/lib/posts";
import { AVATAR_VIDEO_MAX_SECONDS } from "@shared/post-video";
import { PostVideoTrimmerModal } from "@/features/posts/video-trim/PostVideoTrimmerModal";
import { fetchMyBusinessStatusRequestState, submitMyBusinessStatusRequest } from "@/lib/business-status";

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Мужской" },
  { value: "female", label: "Женский" },
  { value: "other", label: "Другое" },
];

function genderForForm(raw: unknown): Gender | "" {
  const g = normalizeGenderFromApi(raw);
  return g === "male" || g === "female" || g === "other" ? g : "";
}

export default function EditProfile() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, refetch, setUserFromLogin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [authLoading, user, setLocation]);

  const [editDisplayName, setEditDisplayName] = useState("");
  const [editSurname, setEditSurname] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [editGender, setEditGender] = useState<Gender | "">("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [editBio, setEditBio] = useState("");
  const [editProfileLink, setEditProfileLink] = useState("");
  const [editCoverUrl, setEditCoverUrl] = useState("");
  const [editShowCover, setEditShowCover] = useState(true);
  const [avatarCropDataUrl, setAvatarCropDataUrl] = useState<string | null>(null);
  const [avatarVideoTrimFile, setAvatarVideoTrimFile] = useState<File | null>(null);
  const [avatarVideoTrimOpen, setAvatarVideoTrimOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUploadPercent, setAvatarUploadPercent] = useState<number | null>(null);
  const [coverUploadPercent, setCoverUploadPercent] = useState<number | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverImageError, setCoverImageError] = useState(false);
  const [coverAdjustDataUrl, setCoverAdjustDataUrl] = useState<string | null>(null);
  const [avatarImageError, setAvatarImageError] = useState(false);
  const [error, setError] = useState("");
  const [businessReason, setBusinessReason] = useState("");
  const [businessLink1, setBusinessLink1] = useState("");
  const [businessLink2, setBusinessLink2] = useState("");
  const [businessLink3, setBusinessLink3] = useState("");
  const [businessConsent, setBusinessConsent] = useState(false);
  const [businessFormError, setBusinessFormError] = useState<string | null>(null);
  const [businessContactPhone, setBusinessContactPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);

  const businessStateQuery = useQuery({
    queryKey: ["users", "me", "business-status-request"],
    queryFn: () => fetchMyBusinessStatusRequestState(),
    enabled: !!user,
  });

  const submitBusinessRequestMutation = useMutation({
    mutationFn: () =>
      submitMyBusinessStatusRequest({
        reason: businessReason,
        links: [businessLink1, businessLink2, businessLink3],
        consentModeration: businessConsent,
      }),
    onSuccess: async () => {
      setBusinessReason("");
      setBusinessLink1("");
      setBusinessLink2("");
      setBusinessLink3("");
      setBusinessConsent(false);
      setBusinessFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["users", "me", "business-status-request"] });
      refetch().catch(() => {});
      toast({ title: "Заявка отправлена", description: "Модератор рассмотрит ее в админке." });
    },
    onError: (err) => {
      setBusinessFormError(err instanceof Error ? err.message : "Не удалось отправить заявку");
    },
  });

  const isLikelyImageFile = useCallback((file: File): boolean => {
    if (file.type && file.type.startsWith("image/")) return true;
    return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name || "");
  }, []);

  useEffect(() => {
    if (!user) return;
    setEditDisplayName((user.displayName ?? "").slice(0, NAME_MAX_LENGTH));
    setEditSurname((user.surname ?? "").slice(0, NAME_MAX_LENGTH));
    setEditNickname(((user as { nickname?: string | null }).nickname ?? "").trim().replace(/^@+/, "").slice(0, NICKNAME_MAX_LENGTH));
    setEditGender(genderForForm(user.gender));
    setEditBirthDate(user.birthDate ?? "");
    setEditCity(((user as { city?: string | null }).city ?? "").trim());
    setEditAvatarUrl(user.avatarUrl ?? "");
    setEditAvatarPreview(user.avatarUrl ? user.avatarUrl : null);
    setEditBio((user as { bio?: string | null }).bio ?? "");
    setEditProfileLink((user as { profileLink?: string | null }).profileLink ?? "");
    setEditCoverUrl((user as { coverUrl?: string | null }).coverUrl ?? "");
    setEditShowCover((user as { showCover?: boolean }).showCover !== false);
    setBusinessContactPhone((user as { businessContactPhone?: string | null }).businessContactPhone ?? "");
    setBusinessAddress((user as { businessAddress?: string | null }).businessAddress ?? "");
    setCoverImageError(false);
    setAvatarImageError(false);
  }, [user]);

  const handleEditAvatarFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      if (file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v|3gp)$/i.test(file.name)) {
        setAvatarVideoTrimFile(file);
        setAvatarVideoTrimOpen(true);
        return;
      }
      if (!isLikelyImageFile(file)) {
        toast({ title: "Выберите изображение или видео", variant: "destructive" });
        return;
      }
      const isHeicPick =
        /\.(heic|heif)$/i.test(file.name || "") || /image\/hei[cf]/i.test(file.type || "");
      if (isHeicPick) {
        setUploadingAvatar(true);
        setAvatarUploadPercent(0);
        void uploadAvatar(file, { onProgress: (p) => setAvatarUploadPercent(p) })
          .then((url) => {
            setEditAvatarUrl(url);
            setEditAvatarPreview(url);
            setAvatarImageError(false);
            toast({ title: "Аватар загружен" });
          })
          .catch((err) => {
            toast({
              title: "Ошибка загрузки аватара",
              description: err instanceof Error ? err.message : "Попробуйте другой файл",
              variant: "destructive",
            });
          })
          .finally(() => {
            setUploadingAvatar(false);
            setAvatarUploadPercent(null);
          });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setAvatarCropDataUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    [isLikelyImageFile, toast],
  );

  const onAvatarVideoTrimConfirm = useCallback(
    async (trim: PostVideoTrimUpload) => {
      const file = avatarVideoTrimFile;
      if (!file) return;
      setAvatarVideoTrimOpen(false);
      setAvatarVideoTrimFile(null);
      setUploadingAvatar(true);
      setAvatarUploadPercent(0);
      try {
        const url = await uploadPostMedia(file, trim, {
          trimMaxSeconds: AVATAR_VIDEO_MAX_SECONDS,
          onProgress: (p) => setAvatarUploadPercent(p),
        });
        setEditAvatarUrl(url);
        setEditAvatarPreview(url);
        setAvatarImageError(false);
        toast({ title: "Видео загружено", description: "Нажмите «Сохранить», чтобы применить живой аватар." });
      } catch (err) {
        toast({
          title: "Не удалось загрузить видео",
          description: err instanceof Error ? err.message : "Попробуйте другой файл",
          variant: "destructive",
        });
      } finally {
        setUploadingAvatar(false);
        setAvatarUploadPercent(null);
      }
    },
    [avatarVideoTrimFile, toast],
  );

  const clearEditAvatar = useCallback(() => {
    setEditAvatarUrl("");
    setEditAvatarPreview(null);
    setAvatarImageError(false);
  }, []);

  /** Сборка тела PATCH /users/me; `coverUrlOverride` — сразу после upload, до setState. */
  const buildProfileSavePayload = useCallback(
    (coverUrlOverride?: string | null) => {
      const nick = editNickname.trim().replace(/^@+/, "").slice(0, NICKNAME_MAX_LENGTH);
      const trimmedAv = editAvatarUrl.trim();
      const coverResolved =
        coverUrlOverride !== undefined
          ? coverUrlOverride === null || coverUrlOverride === ""
            ? null
            : coverUrlOverride.trim() || null
          : editCoverUrl.trim() || null;
      return {
        displayName: editDisplayName.trim().slice(0, NAME_MAX_LENGTH),
        surname: editSurname.trim().slice(0, NAME_MAX_LENGTH),
        nickname: nick.length > 0 ? nick : null,
        gender: editGender || undefined,
        birthDate: editBirthDate.trim() ? editBirthDate.trim() : null,
        ...(trimmedAv && !trimmedAv.startsWith("data:") ? { avatarUrl: trimmedAv } : {}),
        bio: editBio.trim() || null,
        city: editCity.trim() || null,
        profileLink: editProfileLink.trim() || null,
        coverUrl: coverResolved,
        showCover: editShowCover,
        ...((user?.businessStatus ?? "none") === "approved"
          ? {
              businessContactPhone: businessContactPhone.trim() || null,
              businessAddress: businessAddress.trim() || null,
            }
          : {}),
      };
    },
    [
      editNickname,
      editAvatarUrl,
      editCoverUrl,
      editDisplayName,
      editSurname,
      editGender,
      editBirthDate,
      editBio,
      editCity,
      editProfileLink,
      editShowCover,
      businessContactPhone,
      businessAddress,
      user?.businessStatus,
    ],
  );

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
        const updated = await updateProfile(buildProfileSavePayload());
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
    [buildProfileSavePayload, setUserFromLogin, refetch, toast, setLocation],
  );

  const persistProfileAfterCoverUpload = useCallback(
    async (uploadedCoverUrl: string) => {
      if (!editDisplayName.trim() || !editSurname.trim() || !editGender) {
        toast({
          title: "Шапка загружена",
          description: "Заполните имя, фамилию и пол, затем нажмите «Сохранить» внизу.",
        });
        return;
      }
      const updated = await updateProfile(buildProfileSavePayload(uploadedCoverUrl));
      setUserFromLogin(updated);
      refetch().catch(() => {});
      toast({ title: "Шапка сохранена в профиле" });
    },
    [
      buildProfileSavePayload,
      editDisplayName,
      editSurname,
      editGender,
      setUserFromLogin,
      refetch,
      toast,
    ],
  );

  const handleCoverFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
      // HEIC в canvas часто не декодируется — грузим файл сразу на сервер (там конвертация в JPEG).
      const isHeic =
        (file.type && /heic|heif/i.test(file.type)) || /\.(heic|heif)$/i.test(file.name || "");
      if (isHeic) {
        e.target.value = "";
        setUploadingCover(true);
        setCoverUploadPercent(0);
        uploadCover(file, { onProgress: (p) => setCoverUploadPercent(p) })
          .then(async (url) => {
            setEditCoverUrl(url);
            setCoverImageError(false);
            try {
              await persistProfileAfterCoverUpload(url);
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Ошибка сохранения";
              toast({
                title: "Шапка загружена",
                description: msg.includes("401") ? "Сессия истекла. Войдите снова." : `${msg} Нажмите «Сохранить» внизу.`,
                variant: "destructive",
              });
            }
          })
          .catch((err) => {
            setCoverImageError(true);
            const msg = err instanceof Error ? err.message : "Проверьте интернет и попробуйте снова";
            toast({ title: "Ошибка загрузки шапки", description: msg, variant: "destructive" });
          })
          .finally(() => {
            setUploadingCover(false);
            setCoverUploadPercent(null);
          });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setCoverAdjustDataUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [isLikelyImageFile, toast, persistProfileAfterCoverUpload],
  );

  const openCoverAdjustExisting = useCallback(async () => {
    const raw = editCoverUrl.trim();
    if (!raw) {
      toast({
        title: "Нет обложки",
        description: "Сначала загрузите изображение.",
        variant: "destructive",
      });
      return;
    }
    if (raw.startsWith("data:")) {
      setCoverAdjustDataUrl(raw);
      return;
    }
    try {
      const dataUrl = await fetchImageAsDataUrl(resolveUrl(raw));
      setCoverAdjustDataUrl(dataUrl);
    } catch {
      toast({
        title: "Не удалось открыть редактор",
        description: "Проверьте сеть или загрузите шапку заново.",
        variant: "destructive",
      });
    }
  }, [editCoverUrl, toast]);

  const handleCoverAdjustConfirm = useCallback(
    (file: File) => {
      setCoverAdjustDataUrl(null);
      setUploadingCover(true);
      setCoverUploadPercent(0);
      uploadCover(file, { onProgress: (p) => setCoverUploadPercent(p) })
        .then(async (url) => {
          setEditCoverUrl(url);
          setCoverImageError(false);
          try {
            await persistProfileAfterCoverUpload(url);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Ошибка сохранения";
            toast({
              title: "Шапка загружена",
              description: msg.includes("401") ? "Сессия истекла. Войдите снова." : `${msg} Нажмите «Сохранить» внизу.`,
              variant: "destructive",
            });
          }
        })
        .catch((err) => {
          setCoverImageError(true);
          const msg = err instanceof Error ? err.message : "Проверьте интернет и попробуйте снова";
          toast({ title: "Ошибка загрузки шапки", description: msg, variant: "destructive" });
        })
        .finally(() => {
          setUploadingCover(false);
          setCoverUploadPercent(null);
        });
    },
    [toast, persistProfileAfterCoverUpload],
  );

  const businessStatus = businessStateQuery.data?.businessStatus ?? user?.businessStatus ?? "none";
  const canSubmitBusinessRequest =
    businessStatus === "none" || businessStatus === "rejected" || businessStatus === "revision_required";
  const activeBusinessRequest = businessStateQuery.data?.activeRequest ?? null;

  const handleBusinessRequestSubmit = useCallback(
    () => {
      setBusinessFormError(null);
      if (!canSubmitBusinessRequest) {
        setBusinessFormError("Новая заявка сейчас недоступна");
        return;
      }
      if (!businessReason.trim()) {
        setBusinessFormError("Опишите, зачем вам бизнес-статус");
        return;
      }
      if (!businessConsent) {
        setBusinessFormError("Подтвердите согласие на модерацию");
        return;
      }
      submitBusinessRequestMutation.mutate();
    },
    [businessReason, businessConsent, canSubmitBusinessRequest, submitBusinessRequestMutation],
  );

  if (authLoading || !user) {
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
    <div className="flex flex-col min-h-[100dvh] bg-background w-full max-w-full overflow-x-hidden">
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
        <form onSubmit={handleSubmit} className="p-0 pb-[calc(var(--uix-nav-bottom)+env(safe-area-inset-bottom,0px)+24px)] w-full min-w-0 box-border">
          {/* Блок шапки — от края до края без отступов */}
          <div className="w-[100vw] max-w-none ml-[calc(-50vw+50%)] mb-5">
            <div className="space-y-2 px-4">
              <Label>Шапка профиля</Label>
              <p className="text-sm leading-snug text-muted-foreground">
                Ваша обложка профиля — так ваш профиль будет ярче.
              </p>
            </div>
            <input
              id="edit-profile-cover-file"
              ref={coverFileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleCoverFile}
              disabled={uploadingCover}
            />
            {editCoverUrl && !coverImageError ? (
              <div className="w-full border-y border-border bg-muted/30">
                <div className="relative overflow-hidden w-full">
                  <img
                    src={resolveUrl(editCoverUrl)}
                    alt=""
                    className="w-full h-36 sm:h-44 md:h-48 object-cover block"
                    onError={() => setCoverImageError(true)}
                  />
                  {uploadingCover && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 px-4 py-6">
                      <UploadProgressPanel
                        title="Загрузка обложки"
                        percent={coverUploadPercent}
                        tone="inverse"
                        size="md"
                        footnote={coverUploadPercent != null ? "Отправка на сервер…" : null}
                        className="w-full max-w-[240px]"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-4 border-t border-border bg-background px-4 py-4">
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      className="w-full min-h-[var(--uix-touch-min)]"
                      disabled={uploadingCover}
                      onClick={() => coverFileInputRef.current?.click()}
                    >
                      {uploadingCover ? "Загрузка…" : "Заменить обложку"}
                    </Button>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-[var(--uix-touch-min)] flex-1"
                        onClick={() => void openCoverAdjustExisting()}
                        disabled={uploadingCover}
                      >
                        Положение и масштаб
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-[var(--uix-touch-min)] flex-1"
                        onClick={() => {
                          setEditCoverUrl("");
                          setCoverImageError(false);
                        }}
                        disabled={uploadingCover}
                      >
                        Удалить обложку
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-secondary/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Показывать обложку</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Если выключить, обложка сохранится, но не будет видна в профиле.
                        </p>
                      </div>
                      <Switch
                        checked={editShowCover}
                        onCheckedChange={setEditShowCover}
                        aria-label="Показывать обложку профиля"
                      />
                    </div>
                    <div className="mt-3 rounded-xl border border-border/70 bg-background p-2">
                      <p className="px-1 pb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                        Превью профиля
                      </p>
                      {editCoverUrl && editShowCover ? (
                        <div className="overflow-hidden rounded-lg border border-border/60">
                          <img
                            src={resolveUrl(editCoverUrl)}
                            alt="Превью обложки"
                            className="h-20 w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex min-h-[80px] items-center justify-center rounded-lg border border-dashed border-border bg-secondary/20 px-3 text-center">
                          <p className="text-xs text-muted-foreground">
                            {editCoverUrl ? "Обложка сейчас скрыта в профиле" : "Загрузите обложку, чтобы увидеть превью"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {coverImageError ? (
                  <div className="px-4 space-y-2">
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                      Не удалось загрузить изображение. Замените файл или удалите.
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        className="min-h-[var(--uix-touch-min)] flex-1"
                        disabled={uploadingCover}
                        onClick={() => coverFileInputRef.current?.click()}
                      >
                        Заменить обложку
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-[var(--uix-touch-min)] flex-1"
                        onClick={() => {
                          setEditCoverUrl("");
                          setCoverImageError(false);
                        }}
                        disabled={uploadingCover}
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="edit-profile-cover-file"
                    className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 h-24 w-full hover:bg-muted/30 transition-colors min-w-0"
                  >
                    <span className="text-sm text-muted-foreground">
                      {uploadingCover ? "Загрузка…" : "Выбрать изображение для шапки"}
                    </span>
                  </label>
                )}
              </>
            )}
          </div>

          <div className="px-4 space-y-5 uix-responsive-max-w">
          {(!editCoverUrl || coverImageError) && (
            <div className="rounded-xl border border-border/70 bg-secondary/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Показывать обложку</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Если выключить, обложка сохранится, но не будет видна в профиле.
                  </p>
                </div>
                <Switch
                  checked={editShowCover}
                  onCheckedChange={setEditShowCover}
                  aria-label="Показывать обложку профиля"
                />
              </div>
              <div className="mt-3 rounded-xl border border-border/70 bg-background p-2">
                <p className="px-1 pb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                  Превью профиля
                </p>
                <div className="flex min-h-[80px] items-center justify-center rounded-lg border border-dashed border-border bg-secondary/20 px-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    {coverImageError
                      ? "Сначала загрузите рабочее изображение"
                      : editCoverUrl && !editShowCover
                        ? "Обложка сейчас скрыта в профиле"
                        : "Загрузите обложку, чтобы увидеть превью"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            <div className="text-center space-y-1">
              <Label>Аватар</Label>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-snug">
                Одно фото сохраняется <span className="font-medium text-foreground">квадратом</span>: в шапке профиля — сквиркл, в чатах и списках — круг (маска в интерфейсе).
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {editAvatarPreview ? (
                <>
                  <div className="relative rounded-2xl px-2 py-2">
                    {avatarImageError ? (
                      <div className="h-20 w-20 rounded-full border-2 border-destructive/50 bg-destructive/10 flex items-center justify-center text-destructive text-xs text-center px-1 mx-auto">
                        Ошибка загрузки
                      </div>
                    ) : (
                      <div className="flex items-end justify-center gap-6">
                        <div className="flex flex-col items-center gap-1">
                          <UserAvatar
                            avatarUrl={editAvatarPreview}
                            displayName={editDisplayName}
                            seed={user.id}
                            size={PULSE_PROFILE_AVATAR_INNER_PX}
                            cornerRadius={PULSE_PROFILE_AVATAR_SQUIRCLE_INNER_RX}
                            className="ring-2 ring-border"
                            videoAlwaysActive
                          />
                          <span className="text-[10px] text-muted-foreground">Профиль</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <UserAvatar
                            avatarUrl={editAvatarPreview}
                            displayName={editDisplayName}
                            seed={user.id}
                            size={56}
                            className="ring-2 ring-border"
                            videoAlwaysActive
                          />
                          <span className="text-[10px] text-muted-foreground">Чаты</span>
                        </div>
                      </div>
                    )}
                    {uploadingAvatar && (
                      <span className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-background/85 px-2 backdrop-blur-[2px]">
                        <UploadProgressPanel
                          title="Загрузка аватара"
                          percent={avatarUploadPercent}
                          size="sm"
                          className="w-full max-w-[min(200px,90%)]"
                          footnote={avatarUploadPercent != null ? "Отправка на сервер…" : null}
                        />
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
                  accept="image/*,video/mp4,video/webm,video/quicktime,video/x-m4v"
                  className="sr-only"
                  onChange={handleEditAvatarFile}
                />
                <span className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
                  {editAvatarPreview ? "Заменить" : "Фото или видео (до 4 с)"}
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
            <Label htmlFor="editNickname">Никнейм</Label>
            <p className="text-sm text-muted-foreground">
              Показывается в плашке в шапке профиля (рядом с @). Только буквы, цифры, «.», «_», «-». Если пусто — отображается ваш числовой ID.
            </p>
            <Input
              id="editNickname"
              value={editNickname}
              onChange={(e) => setEditNickname(e.target.value.replace(/^@+/, "").slice(0, NICKNAME_MAX_LENGTH))}
              placeholder="например, maria_pulse"
              maxLength={NICKNAME_MAX_LENGTH}
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editGender">Пол *</Label>
            <Select
              value={editGender === "" ? undefined : editGender}
              onValueChange={(v) => {
                if (v === "male" || v === "female" || v === "other") setEditGender(v);
              }}
              required
            >
              <SelectTrigger id="editGender" className="min-h-[var(--uix-touch-min)]">
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
            <Label htmlFor="editCity">Введите город</Label>
            <CitySuggestInput
              id="editCity"
              value={editCity}
              onChange={setEditCity}
              disabled={saving || uploadingAvatar || uploadingCover}
              placeholder="Город"
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

          <div className="space-y-3 rounded-xl border border-border/70 bg-secondary/20 p-4">
            <div className="space-y-1">
              <Label className="text-base">Бизнес-статус</Label>
              <p className="text-sm text-muted-foreground">
                Заявка проверяется модератором. Доступные решения: одобрено, отклонено, отправлено на пересмотр.
              </p>
            </div>
            {businessStateQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Загрузка статуса заявки…</p>
            ) : null}
            {businessStateQuery.isError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <p>Не удалось загрузить статус заявки.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 min-h-[var(--uix-touch-min)]"
                  onClick={() => void businessStateQuery.refetch()}
                >
                  Повторить
                </Button>
              </div>
            ) : null}
            {!businessStateQuery.isLoading && !businessStateQuery.isError ? (
              <div className="rounded-md border border-border/70 bg-background p-3 text-sm">
                <p>
                  Текущий статус:{" "}
                  <span className="font-medium">
                    {businessStatus === "none"
                      ? "Нет заявки"
                      : businessStatus === "pending"
                        ? "На модерации"
                        : businessStatus === "approved"
                          ? "Одобрено"
                          : businessStatus === "rejected"
                            ? "Отклонено"
                            : "Нужно подать заново (пересмотр)"}
                  </span>
                </p>
                {activeBusinessRequest ? (
                  <p className="mt-1 text-muted-foreground">
                    Активная заявка отправлена:{" "}
                    {activeBusinessRequest.createdAt
                      ? new Date(activeBusinessRequest.createdAt).toLocaleString("ru-RU")
                      : "только что"}
                  </p>
                ) : (
                  <p className="mt-1 text-muted-foreground">Активной заявки сейчас нет.</p>
                )}
                {businessStateQuery.data?.latestRequest?.adminComment ? (
                  <p className="mt-2 rounded-md border border-border/70 bg-secondary/30 p-2 text-xs text-muted-foreground">
                    Комментарий модератора: {businessStateQuery.data.latestRequest.adminComment}
                  </p>
                ) : null}
              </div>
            ) : null}

            {businessStatus === "approved" ? (
              <div className="space-y-2 rounded-md border border-border/70 bg-background p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                  Публичные контакты бизнеса
                </p>
                <Input
                  type="tel"
                  value={businessContactPhone}
                  onChange={(e) => setBusinessContactPhone(e.target.value)}
                  placeholder="Телефон для клиентов"
                  disabled={saving || uploadingAvatar || uploadingCover}
                />
                <Input
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  placeholder="Адрес (город, улица, дом)"
                  disabled={saving || uploadingAvatar || uploadingCover}
                />
                <p className="text-xs text-muted-foreground">
                  Эти данные будут видны в вашем профиле как бизнес-контакты.
                </p>
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="business-reason">Причина заявки</Label>
                <textarea
                  id="business-reason"
                  value={businessReason}
                  onChange={(e) => setBusinessReason(e.target.value)}
                  placeholder="Опишите ваш проект, нишу и зачем нужен бизнес-статус"
                  rows={4}
                  className="flex w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none box-border max-w-full"
                  disabled={!canSubmitBusinessRequest || submitBusinessRequestMutation.isPending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="business-link-1">Ссылки (до 3)</Label>
                <Input
                  id="business-link-1"
                  type="url"
                  value={businessLink1}
                  onChange={(e) => setBusinessLink1(e.target.value)}
                  placeholder="https://example.com"
                  disabled={!canSubmitBusinessRequest || submitBusinessRequestMutation.isPending}
                />
                <Input
                  id="business-link-2"
                  type="url"
                  value={businessLink2}
                  onChange={(e) => setBusinessLink2(e.target.value)}
                  placeholder="https://example.com/portfolio"
                  disabled={!canSubmitBusinessRequest || submitBusinessRequestMutation.isPending}
                />
                <Input
                  id="business-link-3"
                  type="url"
                  value={businessLink3}
                  onChange={(e) => setBusinessLink3(e.target.value)}
                  placeholder="https://example.com/social"
                  disabled={!canSubmitBusinessRequest || submitBusinessRequestMutation.isPending}
                />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={businessConsent}
                  onCheckedChange={(checked) => setBusinessConsent(checked === true)}
                  disabled={!canSubmitBusinessRequest || submitBusinessRequestMutation.isPending}
                  aria-label="Согласие на модерацию бизнес-заявки"
                />
                <span className="text-muted-foreground">
                  Подтверждаю, что заявка может быть модерирована, отклонена или возвращена на пересмотр.
                </span>
              </label>
              {businessFormError ? <p className="text-sm text-destructive">{businessFormError}</p> : null}
              {!canSubmitBusinessRequest ? (
                <p className="text-xs text-muted-foreground">
                  Новая заявка будет доступна после решения модератора по текущему статусу.
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="min-h-[var(--uix-touch-min)]"
                onClick={handleBusinessRequestSubmit}
                disabled={!canSubmitBusinessRequest || submitBusinessRequestMutation.isPending}
              >
                {submitBusinessRequestMutation.isPending ? "Отправка…" : "Подать заявку"}
              </Button>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="sticky z-10 flex gap-3 pt-2 pb-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t border-border/40"
               style={{ bottom: "calc(var(--uix-nav-bottom) + env(safe-area-inset-bottom,0px) + 8px)" }}>
            <Button
              type="button"
              variant="outline"
              className="flex-1 min-h-[var(--uix-touch-min)]"
              onClick={() => setLocation("/profile/me")}
            >
              Отмена
            </Button>
            <TapScaleButton
              type="submit"
              haptic
              className="flex-1 rounded-lg min-h-[var(--uix-touch-min)] px-4 py-2 bg-primary text-primary-foreground border border-primary-border font-medium text-sm disabled:opacity-50 disabled:pointer-events-none"
              disabled={saving || uploadingAvatar || uploadingCover}
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </TapScaleButton>
          </div>
          </div>
        </form>
      </div>

      {coverAdjustDataUrl ? (
        <ProfileCoverAdjustModal
          imageDataUrl={coverAdjustDataUrl}
          onCancel={() => setCoverAdjustDataUrl(null)}
          onConfirm={handleCoverAdjustConfirm}
        />
      ) : null}

      {avatarCropDataUrl && (
        <AvatarCropModal
          imageDataUrl={avatarCropDataUrl}
          onConfirm={(cropped) => {
            setEditAvatarUrl(cropped);
            setEditAvatarPreview(cropped);
            setAvatarCropDataUrl(null);
            setUploadingAvatar(true);
            setAvatarUploadPercent(0);
            uploadAvatar(cropped, { onProgress: (p) => setAvatarUploadPercent(p) })
              .then((url) => {
                setEditAvatarUrl(url);
                setEditAvatarPreview(url);
                setAvatarImageError(false);
                toast({ title: "Аватар загружен" });
              })
              .catch((err) => {
                toast({ title: "Ошибка загрузки аватара", description: err?.message ?? "Проверьте интернет и попробуйте снова", variant: "destructive" });
              })
              .finally(() => {
                setUploadingAvatar(false);
                setAvatarUploadPercent(null);
              });
          }}
          onCancel={() => setAvatarCropDataUrl(null)}
        />
      )}

      <PostVideoTrimmerModal
        open={avatarVideoTrimOpen}
        file={avatarVideoTrimFile}
        maxSegmentSeconds={AVATAR_VIDEO_MAX_SECONDS}
        title="Живой аватар"
        description={`Выберите фрагмент до ${AVATAR_VIDEO_MAX_SECONDS} сек. Видео будет обрезано и перекодировано.`}
        onOpenChange={(o) => {
          setAvatarVideoTrimOpen(o);
          if (!o) setAvatarVideoTrimFile(null);
        }}
        onConfirm={(trim) => void onAvatarVideoTrimConfirm(trim)}
      />
    </div>
  );
}
