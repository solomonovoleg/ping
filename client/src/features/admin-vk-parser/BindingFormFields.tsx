import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type VkParserFormUserOption = {
  id: string;
  publicId: number;
  displayName: string | null;
  surname?: string | null;
};

export function BindingFormFields(props: {
  platformUserId: string;
  setPlatformUserId: (v: string) => void;
  userSearch: string;
  setUserSearch: (v: string) => void;
  users: VkParserFormUserOption[];
  vkAccessToken: string;
  setVkAccessToken: (v: string) => void;
  vkOwnerId: string;
  setVkOwnerId: (v: string) => void;
  displayName: string;
  setDisplayName: (v: string) => void;
  parseIntervalMinutes: string;
  setParseIntervalMinutes: (v: string) => void;
  postsPerRun: string;
  setPostsPerRun: (v: string) => void;
  requireModeration: boolean;
  setRequireModeration: (v: boolean) => void;
  visibility: "public" | "followers";
  setVisibility: (v: "public" | "followers") => void;
  cityLine: string;
  setCityLine: (v: string) => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  tokenHint?: string;
  lockPlatformUser?: boolean;
  /** Блокировка полей на время сохранения (создание / обновление). */
  formDisabled?: boolean;
}) {
  const off = props.formDisabled ?? false;
  return (
    <div
      className="space-y-4 max-h-[min(70vh,520px)] overflow-y-auto pr-1"
      aria-busy={off}
    >
      <div className="space-y-2">
        <Label>Автор постов (пользователь платформы)</Label>
        {props.lockPlatformUser ? (
          <p className="text-sm text-muted-foreground font-mono break-all">{props.platformUserId || "—"}</p>
        ) : (
          <>
            <Input
              placeholder="Поиск по имени или ID"
              value={props.userSearch}
              disabled={off}
              onChange={(e) => props.setUserSearch(e.target.value)}
              className="mb-2"
            />
            <select
              className="w-full min-h-[var(--uix-touch-min)] rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
              value={props.platformUserId}
              disabled={off}
              onChange={(e) => props.setPlatformUserId(e.target.value)}
            >
              <option value="">— выберите —</option>
              {props.users.map((u) => (
                <option key={u.id} value={u.id}>
                  #{u.publicId}{" "}
                  {[u.displayName, u.surname].filter(Boolean).join(" ") || "—"}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="vk-token">Токен пользователя ВК</Label>
        <Input
          id="vk-token"
          type="password"
          autoComplete="off"
          placeholder={props.tokenHint || "vk1.a…"}
          value={props.vkAccessToken}
          disabled={off}
          onChange={(e) => props.setVkAccessToken(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="vk-owner">ID стены (owner_id)</Label>
        <Input
          id="vk-owner"
          placeholder="-123456789 для группы"
          value={props.vkOwnerId}
          disabled={off}
          onChange={(e) => props.setVkOwnerId(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Для сообщества — отрицательное число, как во ВКонтакте API.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="vk-label">Подпись в админке (необязательно)</Label>
        <Input
          id="vk-label"
          value={props.displayName}
          disabled={off}
          onChange={(e) => props.setDisplayName(e.target.value)}
          placeholder="Например: Новости района"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="vk-interval">Интервал опроса, мин</Label>
          <Input
            id="vk-interval"
            type="number"
            min={5}
            max={1440}
            value={props.parseIntervalMinutes}
            disabled={off}
            onChange={(e) => props.setParseIntervalMinutes(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vk-per-run">За один прогон, шт.</Label>
          <Input
            id="vk-per-run"
            type="number"
            min={1}
            max={50}
            value={props.postsPerRun}
            disabled={off}
            onChange={(e) => props.setPostsPerRun(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 min-h-[var(--uix-touch-min)] cursor-pointer">
          <input
            type="checkbox"
            checked={props.requireModeration}
            disabled={off}
            onChange={(e) => props.setRequireModeration(e.target.checked)}
            className="rounded border-input"
          />
          <span className="text-sm">Модерация в админке перед публикацией</span>
        </label>
        <label className="flex items-center gap-2 min-h-[var(--uix-touch-min)] cursor-pointer">
          <input
            type="checkbox"
            checked={props.enabled}
            disabled={off}
            onChange={(e) => props.setEnabled(e.target.checked)}
            className="rounded border-input"
          />
          <span className="text-sm">Включено</span>
        </label>
      </div>
      <div className="space-y-2">
        <Label>Видимость поста</Label>
        <select
          className="w-full min-h-[var(--uix-touch-min)] rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
          value={props.visibility}
          disabled={off}
          onChange={(e) => props.setVisibility(e.target.value as "public" | "followers")}
        >
          <option value="public">Публичный</option>
          <option value="followers">Только подписчики</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="vk-city">Город в тексте (как в профиле, необязательно)</Label>
        <Input
          id="vk-city"
          value={props.cityLine}
          disabled={off}
          onChange={(e) => props.setCityLine(e.target.value)}
          placeholder="Москва"
        />
      </div>
    </div>
  );
}
