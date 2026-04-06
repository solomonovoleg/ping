import { Fragment } from "react";
import { cn } from "@/lib/utils";

const MD_IMG = /^\s*!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)\s*$/;

/**
 * Разбор тела справки: абзацы через пустую строку, заголовки `## Текст`,
 * одна строка на картинку: `![](https://…)` или `![подпись](https://…)`.
 */
export function HelpPageProse({ text, className }: { text: string; className?: string }) {
  const normalized = text.replace(/\r\n/g, "\n").trimEnd();
  const blocks: React.ReactNode[] = [];
  let paraLines: string[] = [];

  const flushPara = (keyBase: number) => {
    const raw = paraLines.join("\n").trim();
    paraLines = [];
    if (!raw) return;
    blocks.push(
      <p key={`p-${keyBase}`} className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
        {raw}
      </p>
    );
  };

  let key = 0;
  for (const line of normalized.split("\n")) {
    const imgMatch = line.match(MD_IMG);
    if (imgMatch) {
      flushPara(key++);
      const alt = imgMatch[1]?.trim() || "";
      const src = imgMatch[2]?.trim() ?? "";
      blocks.push(
        <figure key={`img-${key++}`} className="my-2 space-y-1">
          <img
            src={src}
            alt={alt}
            className="max-h-[min(70vh,520px)] w-full rounded-xl border border-border/40 object-contain bg-secondary/20"
            loading="lazy"
            decoding="async"
          />
          {alt ? (
            <figcaption className="text-center text-xs text-muted-foreground">{alt}</figcaption>
          ) : null}
        </figure>,
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushPara(key++);
      blocks.push(
        <h2
          key={`h-${key++}`}
          className="text-sm font-bold uppercase tracking-wide text-foreground pt-1 first:pt-0"
        >
          {line.slice(3).trim()}
        </h2>
      );
    } else if (line.trim() === "") {
      flushPara(key++);
    } else {
      paraLines.push(line);
    }
  }
  flushPara(key++);

  return <div className={cn("space-y-3", className)}>{blocks.length ? blocks : <Fragment />}</div>;
}
