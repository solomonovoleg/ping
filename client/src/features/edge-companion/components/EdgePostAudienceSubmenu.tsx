import { Check } from "lucide-react";
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { EdgeDisplayAudience } from "@/lib/posts";
import { normalizeEdgeDisplayAudienceClient } from "@/lib/posts";

const OPTIONS: { value: EdgeDisplayAudience; label: string }[] = [
  { value: "self", label: "Только себе" },
  { value: "followers", label: "Только подписчикам" },
  { value: "public", label: "Всем в ленте" },
];

type EdgePostAudienceSubmenuProps = {
  current: string | null | undefined;
  disabled?: boolean;
  onPick: (value: EdgeDisplayAudience) => void;
};

/**
 * Подменю «Кому виден EDGE» для меню поста (автор, пост с edgeId).
 */
export function EdgePostAudienceSubmenu({ current, disabled, onPick }: EdgePostAudienceSubmenuProps) {
  const cur = normalizeEdgeDisplayAudienceClient(current);
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="min-h-[var(--uix-touch-min)]" disabled={disabled}>
        Кому виден EDGE
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56">
        {OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            className="flex min-h-[var(--uix-touch-min)] items-center gap-2"
            onClick={() => onPick(opt.value)}
          >
            <span className="min-w-0 flex-1">{opt.label}</span>
            {cur === opt.value ? <Check className="h-4 w-4 shrink-0 opacity-80" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
