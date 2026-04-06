const ENTRIES: { id: string; n: string }[] = [
  { id: "privacy-who", n: "1" },
  { id: "privacy-collect", n: "2" },
  { id: "privacy-purposes", n: "3" },
  { id: "privacy-use", n: "4" },
  { id: "privacy-security", n: "5" },
  { id: "privacy-rights", n: "6" },
  { id: "privacy-delete", n: "7" },
  { id: "privacy-age", n: "8" },
  { id: "privacy-children", n: "9" },
  { id: "privacy-changes", n: "10" },
  { id: "privacy-contact", n: "11" },
];

export function PrivacyTocNav() {
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
