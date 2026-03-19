/**
 * Code block for chat messages: monospace, dark background, copy button.
 * Used for auto-detected code and canvas (!) mode messages.
 */
import { memo, useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerLightHaptic } from "@/lib/capacitor-native";

type CodeBlockProps = {
  code: string;
  lang?: string | null;
  className?: string;
};

function CodeBlockInner({ code, lang, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      triggerLightHaptic();
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [code]);

  return (
    <div className={cn("relative group max-w-[min(280px,80vw)] rounded-lg overflow-hidden", className)}>
      {lang && (
        <div className="flex items-center justify-between px-3 py-1 bg-slate-800 dark:bg-slate-900 border-b border-slate-700/50">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{lang}</span>
        </div>
      )}
      <div className="relative">
        <pre className="overflow-x-auto p-3 bg-slate-900 dark:bg-black/80 text-slate-200 text-[13px] leading-[1.45] font-mono whitespace-pre">
          <code>{code}</code>
        </pre>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleCopy(); }}
          className={cn(
            "absolute top-1.5 right-1.5 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all",
            copied
              ? "bg-green-600/90 text-white"
              : "bg-slate-700/80 text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-slate-600/90 active:bg-slate-500/90"
          )}
          aria-label="Скопировать код"
        >
          {copied ? <><Check className="w-3 h-3" /> Скопировано</> : <><Copy className="w-3 h-3" /> Копировать</>}
        </button>
      </div>
    </div>
  );
}

export const CodeBlock = memo(CodeBlockInner);
