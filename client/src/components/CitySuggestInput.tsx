import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, Loader2 } from "lucide-react";
import { fetchCitySuggestions } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { PROFILE_CITY_MAX_LENGTH } from "@shared/schema";

const DEBOUNCE_MS = 320;
/** Поверх overflow-x-hidden у корневого shell (иначе WebKit обрезает выпадающий список) */
const LIST_Z = 12000;

type CitySuggestInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function CitySuggestInput({
  id,
  value,
  onChange,
  disabled,
  placeholder = "Начните вводить город…",
  className,
}: CitySuggestInputProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const portalListRef = useRef<HTMLUListElement>(null);
  const seqRef = useRef(0);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [listBox, setListBox] = useState<{ top: number; left: number; width: number } | null>(null);

  const runSuggest = useCallback((q: string) => {
    const t = q.trim();
    if (t.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    seqRef.current += 1;
    const seq = seqRef.current;
    setLoading(true);
    fetchCitySuggestions(t)
      .then((list) => {
        if (seq !== seqRef.current) return;
        setSuggestions(list);
      })
      .catch(() => {
        if (seq !== seqRef.current) return;
        setSuggestions([]);
      })
      .finally(() => {
        if (seq !== seqRef.current) return;
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!open || disabled) return;
    const t = value.trim();
    if (t.length < 2) {
      setSuggestions([]);
      return;
    }
    const h = setTimeout(() => runSuggest(value), DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [value, open, disabled, runSuggest]);

  const syncListPosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setListBox({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 200) });
  }, []);

  useLayoutEffect(() => {
    if (!open || suggestions.length === 0) {
      setListBox(null);
      return;
    }
    syncListPosition();
    window.addEventListener("resize", syncListPosition);
    window.addEventListener("scroll", syncListPosition, true);
    return () => {
      window.removeEventListener("resize", syncListPosition);
      window.removeEventListener("scroll", syncListPosition, true);
    };
  }, [open, suggestions.length, syncListPosition, value]);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (portalListRef.current?.contains(t)) return;
      setOpen(false);
      setHighlight(-1);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const pick = (s: string) => {
    onChange(s.slice(0, PROFILE_CITY_MAX_LENGTH));
    setOpen(false);
    setHighlight(-1);
    setSuggestions([]);
  };

  const listId = `${id ?? "city"}-listbox`;
  const showList = open && suggestions.length > 0 && listBox != null;

  const listEl =
    showList && typeof document !== "undefined" ? (
      <ul
        ref={portalListRef}
        id={listId}
        role="listbox"
        className="fixed max-h-[min(240px,40vh)] overflow-y-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
        style={{
          top: listBox.top,
          left: listBox.left,
          width: listBox.width,
          zIndex: LIST_Z,
        }}
      >
        {suggestions.map((s, i) => (
          <li key={`${s}-${i}`} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={i === highlight}
              className={cn(
                "flex w-full px-3 py-2.5 text-left text-sm transition-colors",
                i === highlight ? "bg-accent text-accent-foreground" : "hover:bg-muted/80"
              )}
              onMouseDown={(ev) => {
                ev.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id={id}
          type="text"
          value={value}
          disabled={disabled}
          maxLength={PROFILE_CITY_MAX_LENGTH}
          onChange={(e) => onChange(e.target.value.slice(0, PROFILE_CITY_MAX_LENGTH))}
          onFocus={() => {
            if (blurTimerRef.current) {
              clearTimeout(blurTimerRef.current);
              blurTimerRef.current = null;
            }
            setOpen(true);
            const t = value.trim();
            if (t.length >= 2) {
              runSuggest(value);
            }
          }}
          onBlur={() => {
            blurTimerRef.current = setTimeout(() => {
              setOpen(false);
              setHighlight(-1);
            }, 200);
          }}
          onKeyDown={(e) => {
            if (!open || suggestions.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((i) => (i + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
            } else if (e.key === "Enter" && highlight >= 0 && suggestions[highlight]) {
              e.preventDefault();
              pick(suggestions[highlight]);
            } else if (e.key === "Escape") {
              setOpen(false);
              setHighlight(-1);
            }
          }}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          className={cn(
            "flex h-10 w-full min-w-0 rounded-md border border-input bg-background py-2 pl-9 pr-9 text-sm ring-offset-background",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          placeholder={placeholder}
        />
        {loading ? (
          <Loader2
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </div>
      {listEl ? createPortal(listEl, document.body) : null}
    </div>
  );
}
