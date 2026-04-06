const ENTRIES: { id: string; n: string }[] = [
  { id: "terms-service", n: "1" },
  { id: "terms-account", n: "2" },
  { id: "terms-ugc", n: "3" },
  { id: "terms-moderation", n: "4" },
  { id: "terms-conduct", n: "5" },
  { id: "terms-ip", n: "6" },
  { id: "terms-warranty", n: "7" },
  { id: "terms-liability", n: "8" },
  { id: "terms-termination", n: "9" },
  { id: "terms-changes", n: "10" },
  { id: "terms-law", n: "11" },
];

export function TermsTocNav() {
  return (
    <nav aria-label="Содержание документа" className="rounded-xl border border-border/50 bg-muted/25 px-3 py-2.5 text-sm">
      <span className="font-medium text-foreground">К разделам: </span>
      {ENTRIES.map((e, i) => (
        <span key={e.id}>
          {i > 0 ? <span className="text-muted-foreground/60"> · </span> : null}
          <a
            href={`#${e.id}`}
            className="rounded-sm text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {e.n}
          </a>
        </span>
      ))}
    </nav>
  );
}
