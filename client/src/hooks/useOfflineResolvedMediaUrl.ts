import { useEffect, useState } from "react";
import { ensureMediaCached, getCachedMediaObjectUrl } from "@/lib/media-offline-cache";

type Options = {
  autoCache?: boolean;
};

export function useOfflineResolvedMediaUrl(src: string, options?: Options): string {
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const autoCache = options?.autoCache === true;

  useEffect(() => {
    let cancelled = false;
    const normalized = typeof src === "string" ? src.trim() : "";
    if (!normalized) {
      setResolvedSrc("");
      return () => {
        cancelled = true;
      };
    }
    if (normalized.startsWith("blob:") || normalized.startsWith("data:")) {
      setResolvedSrc(normalized);
      return () => {
        cancelled = true;
      };
    }

    setResolvedSrc(normalized);
    void getCachedMediaObjectUrl(normalized).then((cachedUrl) => {
      if (cancelled) return;
      if (cachedUrl) {
        setResolvedSrc(cachedUrl);
        return;
      }
      if (!autoCache) return;
      void ensureMediaCached(normalized).then((freshCachedUrl) => {
        if (!cancelled && freshCachedUrl) {
          setResolvedSrc(freshCachedUrl);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [src, autoCache]);

  return resolvedSrc;
}
