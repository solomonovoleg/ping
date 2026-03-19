/**
 * Страница детального просмотра трека.
 */
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { API, apiFetch } from "@/lib/api-base";
import { TrackDetailView } from "@/features/board/tracks";
import { Skeleton } from "@/components/ui/skeleton";

export default function BoardTracksDetail() {
  const [, params] = useRoute("/board/tracks/:trackId");
  const trackId = params?.trackId ?? "";

  const { data: track, isLoading, error } = useQuery({
    queryKey: ["tracks", trackId, "meta"],
    queryFn: async () => {
      const res = await apiFetch(`${API}/tracks/${encodeURIComponent(trackId)}`);
      if (!res.ok) throw new Error("Трек не найден");
      return res.json() as Promise<{ id: string; name: string | null }>;
    },
    enabled: !!trackId,
  });

  if (!trackId) return null;
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-14 flex items-center px-4" />
        <div className="p-4">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      </div>
    );
  }
  if (error || !track) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6">
        <p className="text-destructive">Трек не найден</p>
      </div>
    );
  }

  return <TrackDetailView trackId={trackId} trackName={track.name || "Трек"} />;
}
