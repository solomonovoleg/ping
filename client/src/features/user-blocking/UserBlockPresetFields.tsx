import type { BlockPresetId } from "./types";

const ORDER: BlockPresetId[] = ["chatOnly", "chatAndSocial", "socialOnly", "full"];

const LABELS: Record<BlockPresetId, { title: string; hint: string }> = {
  chatOnly: { title: "Только сообщения", hint: "Не сможет писать вам в личку." },
  chatAndSocial: {
    title: "Сообщения и активность",
    hint: "Личка + запрет реакций и комментариев.",
  },
  socialOnly: { title: "Только активность", hint: "Запретить реакции и комментарии." },
  full: {
    title: "Полная блокировка",
    hint: "Сообщения, профиль и активность будут недоступны.",
  },
};

type Props = {
  value: BlockPresetId;
  onChange: (id: BlockPresetId) => void;
  disabled?: boolean;
};

export function UserBlockPresetFields({ value, onChange, disabled }: Props) {
  return (
    <div className="mt-2 space-y-2">
      {ORDER.map((id) => {
        const sel = value === id;
        const { title, hint } = LABELS[id];
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(id)}
            className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
              sel ? "border-primary/50 bg-primary/5" : "border-border/60 hover:bg-secondary/60"
            }`}
          >
            <span
              className={`mt-1 h-2.5 w-2.5 rounded-full ${sel ? "bg-primary" : "bg-muted-foreground/40"}`}
              aria-hidden
            />
            <span className="flex-1">
              <span className="block font-medium">{title}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
