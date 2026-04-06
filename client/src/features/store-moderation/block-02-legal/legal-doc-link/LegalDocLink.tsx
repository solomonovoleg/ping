import type { ReactNode } from "react";
import { Link } from "wouter";
import { resolveLegalNavigation } from "@/lib/legal-navigation";
import { cn } from "@/lib/utils";

type Props = {
  document: "privacy" | "terms";
  className?: string;
  children: ReactNode;
};

/**
 * Ссылка на политику или условия: внутри SPA — wouter Link, иначе внешний URL (как в App Store Connect).
 */
export function LegalDocLink({ document: doc, className, children }: Props) {
  const nav = resolveLegalNavigation(doc);
  if (nav.mode === "internal") {
    return (
      <Link href={nav.path} className={cn("underline underline-offset-2 hover:text-foreground", className)}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={nav.href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("underline underline-offset-2 hover:text-foreground", className)}
    >
      {children}
    </a>
  );
}
