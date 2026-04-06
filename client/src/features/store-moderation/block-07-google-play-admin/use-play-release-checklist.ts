import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { MIN_REVIEW_NOTE_LENGTH, PLAY_CHECKLIST_STORAGE_KEY, percentage } from "../readiness-shared";
import { buildPlayReleaseTemplate } from "./build-play-release-template";
import { PLAY_RELEASE_ROWS } from "./play-release-rows";

const VALID_KEYS = new Set(PLAY_RELEASE_ROWS.map((row) => row.key));

type SavedState = { completed: string[]; notesByKey: Record<string, string> };
export type PlayAudienceFilter = "all" | "admin" | "user" | "moderator";

function readState(): SavedState {
  if (typeof window === "undefined") return { completed: [], notesByKey: {} };
  try {
    const raw = window.localStorage.getItem(PLAY_CHECKLIST_STORAGE_KEY);
    if (!raw) return { completed: [], notesByKey: {} };
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed.filter((it) => typeof it === "string" && VALID_KEYS.has(it)) : [],
      notesByKey: parsed.notesByKey && typeof parsed.notesByKey === "object" ? parsed.notesByKey : {},
    };
  } catch {
    return { completed: [], notesByKey: {} };
  }
}

export function usePlayReleaseChecklist() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const initial = useMemo(() => readState(), []);
  const [completed, setCompleted] = useState<Set<string>>(() => new Set(initial.completed));
  const [notesByKey, setNotesByKey] = useState<Record<string, string>>(() => initial.notesByKey);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [audienceFilter, setAudienceFilter] = useState<PlayAudienceFilter>("all");

  const done = completed.size;
  const total = PLAY_RELEASE_ROWS.length;
  const allDone = done === total;
  const hasWeakCompletedNote = PLAY_RELEASE_ROWS.some(
    (row) => completed.has(row.key) && (notesByKey[row.key] ?? "").trim().length < MIN_REVIEW_NOTE_LENGTH,
  );
  const readyForSubmit = allDone && !hasWeakCompletedNote;
  const progress = percentage(done, total);
  const text = useMemo(() => buildPlayReleaseTemplate(completed, notesByKey), [completed, notesByKey]);
  const nextUnchecked = useMemo(() => PLAY_RELEASE_ROWS.find((row) => !completed.has(row.key)), [completed]);
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return PLAY_RELEASE_ROWS.filter((row) => {
      if (audienceFilter !== "all" && row.audience !== audienceFilter) return false;
      if (!normalized) return true;
      return [row.title, row.note, row.route, row.routeLabel].join(" ").toLowerCase().includes(normalized);
    });
  }, [audienceFilter, query]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: SavedState = { completed: Array.from(completed), notesByKey };
    window.localStorage.setItem(PLAY_CHECKLIST_STORAGE_KEY, JSON.stringify(payload));
  }, [completed, notesByKey]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const toggle = (key: string) => {
    const note = (notesByKey[key] ?? "").trim();
    if (!completed.has(key) && note.length < MIN_REVIEW_NOTE_LENGTH) {
      toast({ title: "Добавьте подтверждение", description: `Минимум ${MIN_REVIEW_NOTE_LENGTH} символов перед отметкой пункта.`, variant: "destructive" });
      return;
    }
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return {
    completed,
    copied,
    query,
    audienceFilter,
    setQuery,
    setAudienceFilter,
    setNotesByKey,
    filteredRows,
    done,
    total,
    progress,
    readyForSubmit,
    nextUnchecked,
    openRoute: (route: string) => setLocation(route),
    getNote: (key: string) => notesByKey[key] ?? "",
    toggle,
    openNextUnchecked: () => (nextUnchecked ? setLocation(nextUnchecked.route) : toast({ title: "Все пункты уже закрыты" })),
    copy: async () => {
      if (!readyForSubmit) return toast({ title: "Сначала закройте чеклист и подтверждения", variant: "destructive" });
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast({ title: "Play-чеклист скопирован" });
      } catch {
        toast({ title: "Не удалось скопировать", variant: "destructive" });
      }
    },
    resetMarks: () => setCompleted(new Set<string>()),
    resetNotes: () => setNotesByKey({}),
  };
}
