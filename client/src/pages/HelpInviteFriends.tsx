import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Copy, LayoutGrid, Mail, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  DURATION_NORMAL_S,
  EASING_OUT_BEZIER,
  SPRING_TAP,
  usePrefersReducedMotion,
} from "@/lib/motion";
import { createReferralCode, getMyReferralCodes } from "@/lib/referrals";
import { getMyInviteMoreRequestStatus, submitInviteMoreRequest } from "@/lib/invite-more-request";
import { fetchHelpPage } from "@/lib/help-pages";
import { HelpPageProse } from "@/features/help/HelpPageProse";
import { HelpArticleChrome } from "@/pages/help/HelpArticleChrome";
import { cn } from "@/lib/utils";
import { triggerLightHaptic } from "@/lib/capacitor-native";
import { Skeleton } from "@/components/ui/skeleton";

const QK_CODES = ["referrals", "my-codes"] as const;
const QK_PENDING = ["referrals", "invite-more-pending"] as const;
const QK_HELP = ["help-page", "invite-friends"] as const;

const FALLBACK_TITLE = "Как пригласить друзей";
const FALLBACK_BODY = `## Только по приглашению

PING быстро растёт, поэтому регистрация открыта лишь для тех, кого приглашают те, кто уже внутри. Так мы сохраняем атмосферу доверия и спокойствия.

## Три близких

Вы можете пригласить до трёх самых близких людей и общаться в полном комфорте. У каждого приглашённого тоже будет свой лимит — так друзья зовут своих, и сеть аккуратно расширяется (как знакомство через несколько рукопожатий, только в цифровом мире).

## Ваша личная соцсеть

Чаты, звонки, посты и сториз — всё в одном месте. Делитесь тем, чем хотите: это пространство для вас и вашего круга.

Ниже — ваши активные коды и заявка на расширение лимита, если понадобится ещё приглашений.`;

function isDigitCode(code: string): boolean {
  return /^\d{4}$/.test(code.trim());
}

const VALUE_CHIPS = [
  { icon: ShieldCheck, label: "Только по приглашению", sub: "Доверие и спокойствие" },
  { icon: Users, label: "До трёх близких", sub: "Лимит на человека" },
  { icon: LayoutGrid, label: "Всё в одном", sub: "Чаты, звонки, лента" },
] as const;

export default function HelpInviteFriends() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const reduced = usePrefersReducedMotion();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [requestNote, setRequestNote] = useState("");

  const { data: page, isLoading: pageLoading } = useQuery({
    queryKey: QK_HELP,
    queryFn: () => fetchHelpPage("invite-friends"),
    retry: 1,
  });

  const { data: pack, isLoading: codesLoading } = useQuery({
    queryKey: QK_CODES,
    queryFn: getMyReferralCodes,
  });

  const { data: pendingWrap } = useQuery({
    queryKey: QK_PENDING,
    queryFn: getMyInviteMoreRequestStatus,
  });

  const createDigitsMut = useMutation({
    mutationFn: () => createReferralCode(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK_CODES });
      toast({ title: "Новый код создан", description: "Поделитесь четырьмя цифрами с другом." });
    },
    onError: (e) =>
      toast({ title: e instanceof Error ? e.message : "Не удалось создать код", variant: "destructive" }),
  });

  const submitReqMut = useMutation({
    mutationFn: () => submitInviteMoreRequest(requestNote),
    onSuccess: () => {
      setRequestNote("");
      void qc.invalidateQueries({ queryKey: QK_PENDING });
      toast({
        title: "Заявка отправлена",
        description: "Команда рассмотрит запрос и при необходимости расширит лимит.",
      });
    },
    onError: (e) =>
      toast({ title: e instanceof Error ? e.message : "Не удалось отправить", variant: "destructive" }),
  });

  const codes = pack?.codes ?? [];
  const digitCodes = codes.filter((c) => isDigitCode(c.code));
  const otherCodes = codes.filter((c) => !isDigitCode(c.code));
  const remaining = pack?.remaining ?? 0;
  const pending = pendingWrap?.pending ?? null;

  const title = page?.title?.trim() || FALLBACK_TITLE;
  const proseBody = page?.body?.trim() ? page.body : FALLBACK_BODY;

  const copyCode = (id: string, code: string) => {
    void triggerLightHaptic();
    void navigator.clipboard.writeText(code).then(
      () => {
        setCopiedId(id);
        toast({ title: "Код скопирован" });
        window.setTimeout(() => setCopiedId(null), 2000);
      },
      () => toast({ title: "Не удалось скопировать", variant: "destructive" })
    );
  };

  const fadeProps = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: DURATION_NORMAL_S * 0.9, ease: EASING_OUT_BEZIER },
      };

  const staggerContainer = reduced
    ? undefined
    : {
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: 0.07, delayChildren: 0.08 },
        },
      };
  const staggerItem = reduced
    ? undefined
    : {
        hidden: { opacity: 0, y: 12 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: DURATION_NORMAL_S * 0.85, ease: EASING_OUT_BEZIER },
        },
      };

  return (
    <HelpArticleChrome title={title}>
      <div className="space-y-7">
        {/* Микро-лендинг: герой + логотип */}
        <motion.section
          className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-b from-primary/[0.12] via-card/90 to-background px-5 pb-6 pt-8 shadow-[0_24px_80px_-32px_hsl(var(--primary)/0.35)]"
          {...fadeProps}
        >
          {!reduced ? (
            <>
              <motion.div
                className="pointer-events-none absolute -left-16 top-0 h-48 w-48 rounded-full bg-primary/25 blur-3xl"
                aria-hidden
                animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.08, 1] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="pointer-events-none absolute -right-12 bottom-0 h-44 w-44 rounded-full bg-violet-500/20 blur-3xl"
                aria-hidden
                animate={{ opacity: [0.25, 0.45, 0.25], scale: [1, 1.06, 1] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              />
            </>
          ) : (
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-violet-500/10"
              aria-hidden
            />
          )}
          <div className="relative flex flex-col items-center text-center">
            <motion.div
              className="relative mb-4"
              {...(reduced
                ? {}
                : { initial: { opacity: 0, scale: 0.88 }, animate: { opacity: 1, scale: 1 }, transition: SPRING_TAP })}
            >
              <div className="absolute inset-0 -m-3 rounded-3xl bg-primary/20 blur-xl" aria-hidden />
              <img
                src="/logo.png"
                alt=""
                width={88}
                height={88}
                className="relative h-[5.5rem] w-[5.5rem] rounded-[1.35rem] object-contain shadow-2xl ring-2 ring-primary/25 drop-shadow-[0_8px_32px_hsl(var(--primary)/0.25)]"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </motion.div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/90">PING</p>
            <h2 className="mt-2 max-w-[18rem] text-lg font-bold leading-snug tracking-tight text-foreground">
              Пригласите тех, кому доверяете
            </h2>
            <p className="mt-2 max-w-[17rem] text-sm leading-relaxed text-muted-foreground">
              Личная сеть для близкого круга — без лишнего шума.
            </p>
          </div>

          <motion.ul
            className="relative mt-6 grid grid-cols-3 gap-2"
            {...(!reduced && staggerContainer && staggerItem
              ? { variants: staggerContainer, initial: "hidden" as const, animate: "show" as const }
              : {})}
          >
            {VALUE_CHIPS.map(({ icon: Icon, label, sub }) => (
              <motion.li
                key={label}
                {...(!reduced && staggerItem ? { variants: staggerItem } : {})}
                className="flex flex-col items-center rounded-2xl border border-border/50 bg-background/55 px-2 py-3 text-center backdrop-blur-sm"
              >
                <div className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                </div>
                <span className="text-[10px] font-bold leading-tight text-foreground">{label}</span>
                <span className="mt-0.5 text-[9px] leading-tight text-muted-foreground">{sub}</span>
              </motion.li>
            ))}
          </motion.ul>
        </motion.section>

        {pageLoading ? (
          <div className="space-y-3 rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm">
            <Skeleton className="mx-auto h-3 w-24 rounded-full" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <motion.div
            className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-b from-card/95 to-muted/20 p-6 shadow-inner backdrop-blur-md"
            {...fadeProps}
            transition={
              reduced
                ? undefined
                : { duration: DURATION_NORMAL_S * 0.9, ease: EASING_OUT_BEZIER, delay: 0.05 }
            }
          >
            <div className="mb-4 flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
              <span className="text-xs font-bold uppercase tracking-wide text-foreground/90">Как это устроено</span>
            </div>
            <HelpPageProse text={proseBody} className="[&_h2]:text-foreground [&_p]:text-muted-foreground" />
          </motion.div>
        )}

        <motion.section {...fadeProps} className="space-y-4">
          <div className="flex items-end justify-between gap-2">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-violet-500/20 text-primary shadow-sm">
                <Sparkles className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold tracking-tight">Ваши коды</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Передайте другу цифры при регистрации. Коды живут около 12 часов — при необходимости создайте новый.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setLocation("/settings/invites")}
            >
              Все настройки
            </Button>
          </div>

          {codesLoading ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-3">
              {digitCodes.length === 0 && otherCodes.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                  Пока нет активных кодов. Создайте цифровой код ниже — он появится здесь и в{" "}
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => setLocation("/settings/invites")}
                  >
                    настройках
                  </button>
                  .
                </p>
              ) : null}

              {digitCodes.length > 0 ? (
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Цифровые коды
                  </p>
                  <motion.ul
                    className="grid gap-3 sm:grid-cols-3"
                    {...(!reduced && staggerContainer && staggerItem
                      ? { variants: staggerContainer, initial: "hidden" as const, animate: "show" as const }
                      : {})}
                  >
                    {digitCodes.map((c) => (
                      <motion.li key={c.id} {...(!reduced && staggerItem ? { variants: staggerItem } : {})}>
                        <motion.button
                          type="button"
                          onClick={() => copyCode(c.id, c.code)}
                          whileTap={reduced ? undefined : { scale: 0.97 }}
                          className={cn(
                            "relative flex w-full min-h-[var(--uix-touch-min)] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-b from-primary/[0.14] to-primary/[0.04] px-3 py-5 font-mono text-2xl font-bold tracking-[0.2em] text-foreground shadow-[0_12px_40px_-16px_hsl(var(--primary)/0.45)] transition-colors",
                            copiedId === c.id && "border-primary/70 from-primary/20 to-primary/10 ring-2 ring-primary/20"
                          )}
                        >
                          {!reduced ? (
                            <span
                              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent opacity-60"
                              aria-hidden
                            />
                          ) : null}
                          <span className="relative">{c.code}</span>
                          <span className="relative flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {copiedId === c.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} />
                                Скопировано
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" strokeWidth={2.25} />
                                Копировать
                              </>
                            )}
                          </span>
                        </motion.button>
                      </motion.li>
                    ))}
                  </motion.ul>
                </div>
              ) : null}

              {otherCodes.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Другие активные коды
                  </p>
                  <ul className="space-y-2">
                    {otherCodes.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2"
                      >
                        <code className="truncate font-mono text-sm">{c.code}</code>
                        <Button type="button" size="sm" variant="ghost" onClick={() => copyCode(c.id, c.code)}>
                          {copiedId === c.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <Button
                type="button"
                className="w-full rounded-2xl min-h-[var(--uix-touch-min)] bg-gradient-to-r from-primary to-primary/90 shadow-md shadow-primary/25"
                disabled={remaining <= 0 || createDigitsMut.isPending}
                onClick={() => createDigitsMut.mutate()}
              >
                {createDigitsMut.isPending
                  ? "Создаём код…"
                  : remaining <= 0
                    ? "Лимит приглашений исчерпан"
                    : "Создать новый цифровой код"}
              </Button>
              {pack != null ? (
                <div className="space-y-1">
                  <p className="text-center text-xs text-muted-foreground">
                    Приглашено: {pack.usedCount} из {pack.limit}. Осталось слотов: {remaining}.
                  </p>
                  {pack.autoGrant?.repeatEnabled ? (
                    <p className="text-center text-[11px] text-muted-foreground">
                      {pack.autoGrant.bonusGrantedAt
                        ? `Повторная выдача уже начислена (+${pack.autoGrant.repeatInvites}).`
                        : pack.autoGrant.nextGrantAt
                          ? `Следующая авто-выдача +${pack.autoGrant.repeatInvites}: ${new Date(
                              pack.autoGrant.nextGrantAt,
                            ).toLocaleString("ru-RU")}.`
                          : `После исчерпания лимита автоматически выдадим +${pack.autoGrant.repeatInvites} через ${pack.autoGrant.repeatAfterHours} ч.`}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </motion.section>

        <motion.section
          {...fadeProps}
          className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] via-card/80 to-orange-500/[0.06] p-6 shadow-[0_20px_60px_-28px_rgba(245,158,11,0.35)]"
        >
          {!reduced ? (
            <motion.div
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-400/20 blur-2xl"
              aria-hidden
              animate={{ opacity: [0.4, 0.65, 0.4] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : null}
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Mail className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold tracking-tight">Нужно больше приглашений?</h2>
            </div>
          </div>
          <p className="relative mt-3 text-sm leading-relaxed text-muted-foreground">
            Опишите коротко, зачем вам расширение — заявка попадёт в админ-панель. После одобрения лимит увеличится,
            новые коды можно создавать здесь и в настройках.
          </p>
          {pending ? (
            <div className="relative mt-4 rounded-2xl border border-border/80 bg-background/90 px-4 py-3 text-sm backdrop-blur-sm">
              <p className="font-medium">Заявка на рассмотрении</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Отправлено {new Date(pending.createdAt).toLocaleString("ru-RU")}. После решения команды лимит
                обновится — зайдите сюда или в настройки чуть позже.
              </p>
            </div>
          ) : (
            <>
              <Textarea
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value.slice(0, 2000))}
                placeholder="Необязательно: комментарий для команды"
                className="mt-3 min-h-[88px] rounded-xl"
                maxLength={2000}
              />
              <Button
                type="button"
                className="mt-3 w-full rounded-2xl min-h-[var(--uix-touch-min)] border border-amber-500/40 bg-amber-500/15 text-foreground hover:bg-amber-500/25"
                disabled={submitReqMut.isPending}
                onClick={() => submitReqMut.mutate()}
              >
                {submitReqMut.isPending ? "Отправка…" : "Подать заявку"}
              </Button>
            </>
          )}
        </motion.section>
      </div>
    </HelpArticleChrome>
  );
}
