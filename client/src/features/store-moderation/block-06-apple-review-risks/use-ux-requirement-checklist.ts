import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { APPLE_CHECKLIST_STORAGE_KEY, MIN_REVIEW_NOTE_LENGTH, percentage } from "../readiness-shared";
import { buildUxReviewChecklistTemplate } from "./build-ux-review-checklist-template";
import { UX_REVIEW_ROWS } from "./ux-review-rows";

const VALID_KEYS = new Set(UX_REVIEW_ROWS.map((row) => row.key));

type ChecklistState = {
  completedKeys: string[];
  notesByKey: Record<string, string>;
};

export type UxChecklistFilter = "all" | "todo" | "done";

function readInitialState(): ChecklistState {
  if (typeof window === "undefined") return { completedKeys: [], notesByKey: {} };
  try {
    const raw = window.localStorage.getItem(APPLE_CHECKLIST_STORAGE_KEY);
    if (!raw) return { completedKeys: [], notesByKey: {} };
    const parsed = JSON.parse(raw) as Partial<ChecklistState>;
    const completedKeys = Array.isArray(parsed.completedKeys)
      ? parsed.completedKeys.filter((it) => typeof it === "string" && VALID_KEYS.has(it))
      : [];
    const notesByKey = parsed.notesByKey && typeof parsed.notesByKey === "object" ? parsed.notesByKey : {};
    return { completedKeys, notesByKey };
  } catch {
    return { completedKeys: [], notesByKey: {} };
  }
}

export function useUxRequirementChecklist() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const initial = useMemo(() => readInitialState(), []);
  const [completed, setCompleted] = useState<Set<string>>(() => new Set(initial.completedKeys));
  const [notesByKey, setNotesByKey] = useState<Record<string, string>>(() => initial.notesByKey);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UxChecklistFilter>("all");

  const allDone = completed.size === UX_REVIEW_ROWS.length;
  const hasWeakCompletedNote = UX_REVIEW_ROWS.some(
    (row) => completed.has(row.key) && (notesByKey[row.key] ?? "").trim().length < MIN_REVIEW_NOTE_LENGTH,
  );
  const readyForSubmit = allDone && !hasWeakCompletedNote;
  const completionPercent = percentage(completed.size, UX_REVIEW_ROWS.length);
  const checklistText = useMemo(() => buildUxReviewChecklistTemplate(completed, notesByKey), [completed, notesByKey]);
  const nextUnchecked = useMemo(() => UX_REVIEW_ROWS.find((row) => !completed.has(row.key)), [completed]);
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return UX_REVIEW_ROWS.filter((row) => {
      if (filter === "done" && !completed.has(row.key)) return false;
      if (filter === "todo" && completed.has(row.key)) return false;
      if (!normalized) return true;
      return [row.title, row.whyItMatters, row.routeLabel, row.route].join(" ").toLowerCase().includes(normalized);
    });
  }, [completed, filter, query]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: ChecklistState = { completedKeys: Array.from(completed), notesByKey };
    window.localStorage.setItem(APPLE_CHECKLIST_STORAGE_KEY, JSON.stringify(payload));
  }, [completed, notesByKey]);

  useEffect(() => {
    if (!allDone) return;
    toast({ title: "UX-блок 11 полностью закрыт", description: "Чеклист готов к добавлению в Review Notes." });
  }, [allDone, toast]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const toggle = (key: string) => {
    const note = (notesByKey[key] ?? "").trim();
    if (!completed.has(key) && note.length < MIN_REVIEW_NOTE_LENGTH) {
      toast({
        title: "Добавьте подтверждение",
        description: `Перед отметкой укажите, что именно проверили (минимум ${MIN_REVIEW_NOTE_LENGTH} символов).`,
        variant: "destructive",
      });
      return;
    }
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openNextUnchecked = () => {
    if (!nextUnchecked) return toast({ title: "Все пункты уже проверены" });
    setLocation(nextUnchecked.route);
  };

  const copyChecklist = async () => {
    if (!readyForSubmit) return toast({ title: "Сначала закройте чеклист и подтверждения", variant: "destructive" });
    try {
      await navigator.clipboard.writeText(checklistText);
      setCopied(true);
      toast({ title: "UX-чеклист скопирован" });
    } catch {
      toast({ title: "Не удалось скопировать чеклист", variant: "destructive" });
    }
  };

  return {
    completed,
    totalRows: UX_REVIEW_ROWS.length,
    copied,
    query,
    filter,
    setQuery,
    setFilter,
    setNotesByKey,
    filteredRows,
    nextUnchecked,
    readyForSubmit,
    completionPercent,
    toggle,
    openNextUnchecked,
    copyChecklist,
    openRoute: (route: string) => setLocation(route),
    reset: () => {
      setCompleted(new Set<string>());
      setNotesByKey({});
      setQuery("");
      setFilter("all");
    },
    getNote: (key: string) => notesByKey[key] ?? "",
  };
}
