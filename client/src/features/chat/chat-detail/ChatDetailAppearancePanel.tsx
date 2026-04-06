import { useState } from "react";
import { Image, Link2, Check, Type, Languages, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { acceptAiDisclosure, hasAcceptedAiDisclosure } from "@/lib/ai-disclosure";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CHAT_BG_PRESETS,
  MSG_BUBBLE_PRESETS,
  getChatBackgroundStorageKey,
  getChatMsgColorStorageKey,
  type ChatBackgroundPreset,
  type ChatMessageBubblePreset,
} from "./chat-appearance-presets";
import { TRANSLATE_LANGUAGES, type TranslateLangCode } from "@/lib/translate-prefs";

export type ChatAppearanceBgLayout = "compact" | "detailed";

export type ChatDetailAppearancePanelProps = {
  chatId: string;
  chatBgPreset: ChatBackgroundPreset;
  onChatBgPresetChange: (id: ChatBackgroundPreset) => void;
  chatMsgColorPreset: ChatMessageBubblePreset;
  onChatMsgColorPresetChange: (id: ChatMessageBubblePreset) => void;
  /** Групповое меню — компактные свотчи; DM — крупнее + описание пресета */
  bgLayout: ChatAppearanceBgLayout;
  showMediaLinksButton?: boolean;
  onOpenMediaLinks?: () => void;
  chatSpellCheck: boolean;
  onChatSpellCheckChange: (checked: boolean) => void;
  chatTranslateEnabled: boolean;
  onChatTranslateEnabledChange: (checked: boolean) => void;
  translateLang: TranslateLangCode;
  onTranslateLangChange: (lang: TranslateLangCode) => void;
  /** Личка 1:1: показать переключатель «мультиязычный диалог» */
  showDmMultilingual?: boolean;
  dmMultilingualEnabled?: boolean;
  onDmMultilingualChange?: (enabled: boolean) => void;
};

function persistChatBg(chatId: string, id: ChatBackgroundPreset) {
  if (!chatId) return;
  try {
    localStorage.setItem(getChatBackgroundStorageKey(chatId), id);
  } catch {
    /* ignore quota / private mode */
  }
}

function persistMsgBubble(chatId: string, id: ChatMessageBubblePreset) {
  if (!chatId) return;
  try {
    localStorage.setItem(getChatMsgColorStorageKey(chatId), id);
  } catch {
    /* ignore */
  }
}

/** Общий блок: фон чата, цвет исходящих, орфография, перевод (+ опционально вход в медиа/ссылки). Без send/actions. */
export function ChatDetailAppearancePanel({
  chatId,
  chatBgPreset,
  onChatBgPresetChange,
  chatMsgColorPreset,
  onChatMsgColorPresetChange,
  bgLayout,
  showMediaLinksButton,
  onOpenMediaLinks,
  chatSpellCheck,
  onChatSpellCheckChange,
  chatTranslateEnabled,
  onChatTranslateEnabledChange,
  translateLang,
  onTranslateLangChange,
  showDmMultilingual = false,
  dmMultilingualEnabled = false,
  onDmMultilingualChange,
}: ChatDetailAppearancePanelProps) {
  const [translateDisclosureOpen, setTranslateDisclosureOpen] = useState(false);
  const [dmMultiDisclosureOpen, setDmMultiDisclosureOpen] = useState(false);

  return (
    <>
      {showMediaLinksButton && onOpenMediaLinks && (
        <button
          type="button"
          onClick={onOpenMediaLinks}
          className="mb-2 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/70"
        >
          <Image className="h-5 w-5 shrink-0 text-primary" />
          <span className="flex-1 text-sm font-medium">Медиафайлы и ссылки</span>
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      )}
      <p className="px-2 py-1 text-[11px] text-muted-foreground">Фон чата</p>
      {CHAT_BG_PRESETS.map((preset) => {
        const active = preset.id === chatBgPreset;
        if (bgLayout === "compact") {
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                onChatBgPresetChange(preset.id);
                persistChatBg(chatId, preset.id);
              }}
              className={cn(
                "mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors last:mb-0",
                active ? "bg-primary/12" : "hover:bg-secondary/70",
              )}
            >
              <span className={cn("h-8 w-12 shrink-0 rounded-lg border border-white/10", preset.swatchClassName)} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{preset.title}</span>
              {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          );
        }
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              onChatBgPresetChange(preset.id);
              persistChatBg(chatId, preset.id);
            }}
            className={cn(
              "mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors last:mb-0",
              active ? "bg-primary/12" : "hover:bg-secondary/70",
            )}
          >
            <span className={cn("h-10 w-14 shrink-0 rounded-lg border border-white/10", preset.swatchClassName)} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{preset.title}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{preset.description}</span>
            </span>
            {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>
        );
      })}
      <div className="border-t border-border/60 mt-2 pt-2">
        <p className="px-2 py-1 text-[11px] text-muted-foreground">Цвет моих сообщений</p>
        {MSG_BUBBLE_PRESETS.map((preset) => {
          const active = preset.id === chatMsgColorPreset;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                onChatMsgColorPresetChange(preset.id);
                persistMsgBubble(chatId, preset.id);
              }}
              className={cn(
                "mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors last:mb-0",
                active ? "bg-primary/12" : "hover:bg-secondary/70",
              )}
            >
              <span className={cn("h-6 w-6 shrink-0 rounded-full border border-white/20", preset.swatchClassName)} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{preset.title}</span>
              {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>
      <div className="border-t border-border/60 mt-2 pt-2">
        <div className="flex items-center justify-between gap-3 px-2 py-2">
          <div className="flex items-center gap-3 min-w-0">
            <Type className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">Проверка орфографии</p>
              <p className="text-[11px] text-muted-foreground">Автоисправление в этом чате</p>
            </div>
          </div>
          <Switch
            checked={chatSpellCheck}
            onCheckedChange={onChatSpellCheckChange}
            aria-label="Проверка орфографии в этом чате"
          />
        </div>
      </div>
      <div className="border-t border-border/60 mt-2 pt-2">
        {showDmMultilingual && onDmMultilingualChange ? (
          <div className="flex items-center justify-between gap-3 px-2 py-2">
            <div className="flex items-center gap-3 min-w-0">
              <Globe2 className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Мультиязычный диалог</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Каждый пишет на своём языке, собеседник видит перевод. У каждого должен быть выбран свой язык ниже.
                </p>
              </div>
            </div>
            <Switch
              checked={dmMultilingualEnabled}
              onCheckedChange={(checked) => {
                if (checked && !hasAcceptedAiDisclosure("translate")) {
                  setDmMultiDisclosureOpen(true);
                  return;
                }
                onDmMultilingualChange(checked);
              }}
              aria-label="Мультиязычный диалог"
            />
          </div>
        ) : null}
        {!dmMultilingualEnabled ? (
          <div className="flex items-center justify-between gap-3 px-2 py-2">
            <div className="flex items-center gap-3 min-w-0">
              <Languages className="h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">Переводить входящие</p>
                <p className="text-[11px] text-muted-foreground">На ваш язык автоматически</p>
              </div>
            </div>
            <Switch
              checked={chatTranslateEnabled}
              onCheckedChange={(checked) => {
                if (checked && !hasAcceptedAiDisclosure("translate")) {
                  setTranslateDisclosureOpen(true);
                  return;
                }
                onChatTranslateEnabledChange(checked);
              }}
              aria-label="Переводить входящие сообщения"
            />
          </div>
        ) : (
          <div className="px-2 py-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Входящие переводятся на выбранный язык. Собеседнику для своих входящих нужно выбрать язык у себя в этом же чате.
            </p>
          </div>
        )}
        {(chatTranslateEnabled || dmMultilingualEnabled) && (
          <div className="px-2 pb-1">
            <p className="text-[10px] text-muted-foreground/90 mb-1 px-0.5">Мой язык входящих</p>
            <select
              value={translateLang}
              onChange={(e) => onTranslateLangChange(e.target.value as TranslateLangCode)}
              className="w-full rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              aria-label="Мой язык входящих переводов"
            >
              {TRANSLATE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <AlertDialog open={dmMultiDisclosureOpen} onOpenChange={setDmMultiDisclosureOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Мультиязычный диалог</AlertDialogTitle>
            <AlertDialogDescription>
              Сообщения переводятся через внешний AI-сервис (OpenRouter). Включая режим, вы соглашаетесь на обработку текста
              переписки для перевода.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                acceptAiDisclosure("translate");
                setDmMultiDisclosureOpen(false);
                onDmMultilingualChange?.(true);
              }}
            >
              Включить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={translateDisclosureOpen} onOpenChange={setTranslateDisclosureOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>AI-перевод сообщений</AlertDialogTitle>
            <AlertDialogDescription>
              Для автоперевода текст входящих сообщений отправляется на внешний AI-сервис (OpenRouter). Если вы не хотите
              передавать сообщения на внешнюю обработку, оставьте перевод выключенным.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                acceptAiDisclosure("translate");
                setTranslateDisclosureOpen(false);
                onChatTranslateEnabledChange(true);
              }}
            >
              Согласен, включить перевод
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
