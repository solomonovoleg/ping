import { EdgeLeaderboardCard } from "@/features/edge-companion/components/EdgeLeaderboardCard";

type Props = {
  edgeId: string;
};

export function LeaderboardSurfacePanel({ edgeId }: Props) {
  return (
    <div className="uix-content-x box-border min-h-full pb-4 pt-1">
      <EdgeLeaderboardCard edgeId={edgeId} />
    </div>
  );
}
