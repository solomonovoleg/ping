import { cn } from "@/lib/utils";

type Props = {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
};

export function LegalSection({ id, title, children, className }: Props) {
  return (
    <section id={id} className={cn("mt-7 scroll-mt-[5.5rem]", className)}>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-2 space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}
