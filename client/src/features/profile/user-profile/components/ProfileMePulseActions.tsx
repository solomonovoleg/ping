import { Edit3, BarChart2, Share2 } from "lucide-react";
import { PulseProfileIconButton } from "@/features/profile/pulse-profile";

export function ProfileMePulseActions({
  onEdit,
  onShare,
  onStats,
}: {
  onEdit: () => void;
  onShare: () => void;
  onStats: () => void;
}) {
  return (
    <div className="flex gap-2">
      <PulseProfileIconButton variant="primary" icon={Edit3} label="Редактировать" onClick={onEdit} />
      <PulseProfileIconButton variant="surface" icon={BarChart2} label="Статистика" onClick={onStats} />
      <PulseProfileIconButton variant="surface" icon={Share2} label="Поделиться" onClick={onShare} />
    </div>
  );
}
