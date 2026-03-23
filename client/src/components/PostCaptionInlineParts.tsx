import type { ExternalVideoEmbed } from "@/lib/external-video";
import { externalVideoProviderLabel } from "@/lib/external-video";
import { externalVideoMatchesFragment, normalizeCaptionHref } from "@/lib/post-external-video";

const URL_PART_RE = /(https?:\/\/[^\s]+|www\.[^\s]+|#[a-zA-Zа-яёА-ЯЁ0-9_]+)/g;

export function splitPostCaptionSegments(text: string): string[] {
  return text.split(URL_PART_RE);
}

type PostCaptionInlinePartsProps = {
  text: string;
  /** Если задано, совпадающий по канону URL показывается как компактная метка источника. */
  maskExternalEmbed: ExternalVideoEmbed | null;
  onHashtagClick: (tagLower: string) => void;
  linkClassName: string;
  hashtagClassName: string;
};

/**
 * Разбор текста поста: хештеги, ссылки; URL внешнего видео подменяется на метку провайдера.
 */
export function PostCaptionInlineParts({
  text,
  maskExternalEmbed,
  onHashtagClick,
  linkClassName,
  hashtagClassName,
}: PostCaptionInlinePartsProps) {
  return splitPostCaptionSegments(text).map((part, i) => {
    if (!part) return null;
    if (part.startsWith("#")) {
      return (
        <button
          key={i}
          type="button"
          className={hashtagClassName}
          onClick={(e) => {
            e.stopPropagation();
            onHashtagClick(part.slice(1).toLowerCase());
          }}
        >
          {part}
        </button>
      );
    }
    if (/^(https?:\/\/|www\.)/i.test(part)) {
      const href = normalizeCaptionHref(part);
      if (maskExternalEmbed && externalVideoMatchesFragment(part, maskExternalEmbed)) {
        const label = externalVideoProviderLabel(maskExternalEmbed.provider);
        return (
          <a
            key={i}
            href={maskExternalEmbed.watchUrl}
            target="_blank"
            rel="noreferrer noopener nofollow"
            className="inline-flex max-w-full items-center align-baseline"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="inline-flex items-center rounded-md border border-border/45 bg-secondary/45 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
          </a>
        );
      }
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noreferrer noopener nofollow"
          className={linkClassName}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
