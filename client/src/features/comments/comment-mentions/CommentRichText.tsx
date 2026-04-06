import { Fragment, type ReactNode } from "react";
import { useLocation } from "wouter";
import { buildProfilePath } from "@/lib/profile-route";
import { cn } from "@/lib/utils";

/** @[Имя](publicId) → ссылка на профиль; «сырой» @ник — подсветка без ссылки. */
export function CommentRichText({
  text,
  className,
  inline = false,
}: {
  text: string;
  className?: string;
  /** Строка ответа (упоминание + текст в одну строку, как во ВКонтакте). */
  inline?: boolean;
}) {
  const [, setLocation] = useLocation();
  const parts: ReactNode[] = [];
  const re = /@\[([^\]]+)\]\((\d+)\)|@([\wа-яёА-ЯЁ0-9_]+)/gu;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(<Fragment key={`t${k++}`}>{text.slice(last, m.index)}</Fragment>);
    }
    if (m[2] !== undefined) {
      const label = m[1] ?? "";
      const pid = m[2];
      parts.push(
        <button
          key={`m${k++}`}
          type="button"
          className="font-medium text-primary hover:underline underline-offset-2 inline p-0 align-baseline bg-transparent border-0 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setLocation(
              buildProfilePath({ publicId: Number(pid), userId: null, fallbackPath: "/posts" }),
            );
          }}
        >
          @{label}
        </button>,
      );
    } else if (m[3] !== undefined) {
      parts.push(
        <span key={`a${k++}`} className="font-medium text-primary">
          @{m[3]}
        </span>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) {
    parts.push(<Fragment key={`t${k++}`}>{text.slice(last)}</Fragment>);
  }
  const bodyClass = cn(
    "text-[14px] leading-relaxed whitespace-pre-wrap break-words",
    inline ? "inline" : "mb-1",
    className,
  );
  if (inline) {
    return <span className={bodyClass}>{parts}</span>;
  }
  return <p className={bodyClass}>{parts}</p>;
}
