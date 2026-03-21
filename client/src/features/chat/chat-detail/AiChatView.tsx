import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, MoreVertical, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { useAiChat } from "@/features/chat/hooks/useAiChat";
import { formatMessageTime } from "@/features/chat/utils/format";
import { useChatSpacingPreset } from "./useChatSpacingPreset";

/** Экран чата с ИИ (AI OVER): список сообщений, ввод текста, подгрузка контекста */
export function AiChatView() {
  const [, setLocation] = useLocation();
  const ai = useAiChat();
  const [input, setInput] = useState("");
  const { toast } = useToast();
  const spacing = useChatSpacingPreset();

  const handleSend = async () => {
    const text = input.trim();
    if (!text || ai.sending) return;
    setInput("");
    const ok = await ai.send(text);
    if (!ok) toast({ title: "Не удалось отправить", variant: "destructive" });
  };

  return (
    <div className="absolute inset-0 z-[100] flex h-full w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-[radial-gradient(circle_at_top_right,hsl(var(--muted))_0%,hsl(var(--background))_56%,white_100%)] pb-[var(--uix-chat-bottom-pad)] uix-screen">
      <header className={cn("uix-content-x sticky top-0 z-20 mx-1 mt-1 flex items-center justify-between rounded-[20px] border border-indigo-500/20 bg-white/78 shadow-[0_12px_34px_rgba(70,71,211,0.12)] backdrop-blur-xl pt-safe-offset-2 dark:border-slate-700/45 dark:bg-slate-900/76", spacing.headerYClass)}>
        <div className="flex min-w-0 items-center gap-2">
          <TapScaleButton
            type="button"
            onClick={() => setLocation("/")}
            className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] rounded-full p-2 text-indigo-600/90 transition-colors hover:bg-slate-100/50 dark:text-indigo-300/90 dark:hover:bg-slate-800/50"
            aria-label="Назад к чатам"
          >
            <ChevronLeft className="h-6 w-6" />
          </TapScaleButton>
          <img
            src="/ai-over-avatar.png"
            alt="AI OVER"
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-indigo-500/35"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-tight text-indigo-700/95 dark:text-indigo-200">Atmospheric AI</p>
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/90" aria-hidden />
              <span className="truncate text-[11px] font-medium text-muted-foreground/90">в сети</span>
            </div>
          </div>
        </div>
        <TapScaleButton
          type="button"
          className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] rounded-full p-2 text-slate-500/85 transition-colors hover:bg-slate-100/50 dark:text-slate-400/90 dark:hover:bg-slate-800/50"
          aria-label="Меню AI чата"
        >
          <MoreVertical className="h-5 w-5" />
        </TapScaleButton>
      </header>

      <main
        ref={ai.scrollContainerRef}
        className={cn("uix-content-x flex-1 min-h-0 overflow-y-auto overflow-x-hidden", spacing.messageTopPaddingClass)}
        style={{ WebkitOverflowScrolling: "touch", paddingBottom: spacing.aiListBottomPad }}
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <div className="flex justify-center">
            <span className="rounded-full bg-muted/80 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Сегодня</span>
          </div>
          {ai.loading ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" aria-label="Загрузка истории AI чата" />
            </div>
          ) : ai.error ? (
            <ErrorWithRetry
              title="Не удалось загрузить AI чат"
              description={ai.error}
              onRetry={() => ai.refetch()}
              className="min-h-[220px] border-none bg-transparent"
            />
          ) : ai.messages.length === 0 ? (
            <ListEmptyState
              icon={Sparkles}
              title="Диалог пока пуст"
              description="Задайте первый вопрос, и AI сразу начнёт отвечать."
              actionLabel="Начать диалог"
              onAction={() => ai.refetch()}
              className="min-h-[240px] border-none bg-transparent"
            />
          ) : (
            <>
              {ai.hasMore && (
                <div className="flex justify-center">
                  <TapScaleButton
                    type="button"
                    onClick={ai.loadMore}
                    disabled={ai.loadMoreLoading}
                    className="rounded-full bg-indigo-500/10 px-3 py-1.5 text-sm text-indigo-600 transition-colors hover:bg-indigo-500/15 dark:text-indigo-300"
                  >
                    {ai.loadMoreLoading ? "Загрузка..." : "Подгрузить ещё"}
                  </TapScaleButton>
                </div>
              )}
              {ai.messages.map((msg) => (
                <div key={msg.id} className={cn("flex flex-col max-w-[85%] gap-1.5", msg.role === "user" ? "ml-auto items-end" : "items-start")}>
                  <div
                    className={cn(
                      "relative rounded-2xl px-5 py-4 text-[15px] leading-relaxed shadow-[0_4px_20px_rgba(70,71,211,0.06)]",
                      msg.role === "user"
                        ? "rounded-tr-none bg-indigo-600 text-white shadow-[0_8px_30px_rgba(70,71,211,0.18)]"
                        : "rounded-tl-none border border-indigo-500/10 bg-white/80 text-foreground backdrop-blur-sm dark:bg-slate-900/70"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <div className="px-1">
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{formatMessageTime(msg.createdAt)}</span>
                  </div>
                </div>
              ))}
              {ai.sending && (
                <div className="flex items-center gap-3 px-1">
                  <div className="flex gap-1.5 rounded-full bg-muted/70 p-3">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 [animation-delay:200ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 [animation-delay:400ms]" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">AI думает</span>
                </div>
              )}
              <div ref={ai.messagesEndRef} />
            </>
          )}
        </div>
      </main>

      <section className={cn("uix-content-x absolute inset-x-0 bottom-0 z-20 pb-4 pb-safe", spacing.bottomBarYClass)}>
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex items-end gap-2 rounded-3xl border border-white/30 bg-white/75 p-2 shadow-[0_12px_40px_rgba(70,71,211,0.12)] backdrop-blur-2xl dark:border-slate-700/40 dark:bg-slate-900/80">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Введите сообщение..."
              className="min-h-[44px] max-h-28 w-full resize-none bg-transparent px-3 py-2 text-base md:text-[15px] text-foreground outline-none placeholder:text-slate-400"
              rows={1}
              disabled={ai.sending}
            />
            <TapScaleButton
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || ai.sending}
              haptic
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-indigo-400 text-white shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110 disabled:opacity-50"
              aria-label="Отправить в AI чат"
            >
              <Send className="h-5 w-5 translate-x-[-1px]" />
            </TapScaleButton>
          </div>
        </div>
      </section>
    </div>
  );
}
