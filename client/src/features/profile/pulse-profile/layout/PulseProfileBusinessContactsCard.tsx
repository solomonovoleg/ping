import { useMemo } from "react";
import { Copy, MapPinned, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  phone: string | null;
  address: string | null;
  accent: string;
};

function normalizePhoneHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

export function PulseProfileBusinessContactsCard({ phone, address, accent }: Props) {
  const { toast } = useToast();
  const mapHref = useMemo(() => {
    if (!address) return null;
    return `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`;
  }, [address]);

  if (!phone && !address) return null;

  const copyPhone = () => {
    if (!phone) return;
    if (!navigator.clipboard?.writeText) {
      toast({ title: "Копирование недоступно", variant: "destructive" });
      return;
    }
    navigator.clipboard
      .writeText(phone)
      .then(() => toast({ title: "Телефон скопирован" }))
      .catch(() => toast({ title: "Не удалось скопировать", variant: "destructive" }));
  };

  return (
    <section className="mt-3 rounded-2xl border border-border/60 bg-background/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">
        Контакты бизнеса
      </p>

      <div className="mt-2 space-y-1">
        {phone ? (
          <div className="flex items-center gap-1 rounded-xl border border-border/45 bg-background/45 px-1.5">
            <button
              type="button"
              className="min-h-[var(--uix-touch-min)] flex-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-background/65"
              onClick={() => {
                window.location.href = normalizePhoneHref(phone);
              }}
              aria-label="Позвонить по номеру бизнеса"
            >
              <span className="flex items-center gap-2">
                <Phone style={{ width: 14, height: 14, color: accent }} aria-hidden />
                <span className="min-w-0 truncate text-sm font-medium text-foreground">{phone}</span>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Нажмите, чтобы позвонить</span>
            </button>

            <button
              type="button"
              className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] rounded-lg text-muted-foreground transition-colors hover:bg-background/65 hover:text-foreground"
              onClick={copyPhone}
              aria-label="Скопировать телефон бизнеса"
            >
              <Copy className="mx-auto h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}

        {address && mapHref ? (
          <button
            type="button"
            className="min-h-[var(--uix-touch-min)] w-full rounded-xl border border-border/45 bg-background/45 px-3 py-2 text-left transition-colors hover:bg-background/65"
            onClick={() => window.open(mapHref, "_blank", "noopener,noreferrer")}
            aria-label="Открыть адрес в Яндекс Картах"
          >
            <span className="flex items-start gap-2">
              <MapPinned className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} aria-hidden />
              <span className="min-w-0">
                <span className="block break-words text-sm font-medium text-foreground">{address}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">Открыть в Яндекс Картах</span>
              </span>
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
