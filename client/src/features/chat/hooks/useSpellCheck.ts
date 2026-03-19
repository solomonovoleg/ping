/**
 * Хук проверки орфографии с debounce.
 * Не блокирует отправку — результаты только для подсказок.
 */
import { useState, useEffect, useRef } from "react";
import { checkSpelling, type SpellError } from "@/lib/spellcheck";

const DEBOUNCE_MS = 600;
const MIN_LENGTH = 3;

export function useSpellCheck(text: string, enabled = true): SpellError[] {
  const [errors, setErrors] = useState<SpellError[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTextRef = useRef("");

  useEffect(() => {
    if (!enabled || !text || text.trim().length < MIN_LENGTH) {
      setErrors([]);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      lastTextRef.current = text;
      checkSpelling(text).then((result) => {
        if (lastTextRef.current === text) setErrors(result);
      });
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, enabled]);

  return errors;
}
