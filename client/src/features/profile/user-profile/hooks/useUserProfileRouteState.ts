import { useMemo } from "react";
import { useLocation, useParams } from "wouter";
import {
  isInvalidProfileRouteId,
  isOwnProfileRoute,
  normalizeProfileRouteId,
} from "../page/profile-route-identity";

type MeForRoute = { publicId: number; nickname?: string | null } | null | undefined;

export function useUserProfileRouteState(args: {
  paramsProp?: { id: string };
  me: MeForRoute;
  authLoading: boolean;
}) {
  const [, setLocation] = useLocation();
  const paramsFromRoute = useParams<{ id?: string }>();
  const fromPath =
    typeof window !== "undefined"
      ? (window.location.pathname.match(/^\/(?:u|profile|id)\/([^/?#]+)/)?.[1] ?? "")
      : "";
  const id = (args.paramsProp?.id ?? paramsFromRoute?.id ?? fromPath) ?? "";
  const normalizedRouteId = normalizeProfileRouteId(id);
  const hasInvalidRouteId = isInvalidProfileRouteId(normalizedRouteId);

  const isMe = useMemo(
    () =>
      isOwnProfileRoute({
        routeIdRaw: id,
        normalizedRouteId,
        me: args.me,
        authResolved: !args.authLoading,
      }),
    [args.authLoading, args.me, id, normalizedRouteId],
  );

  return {
    id,
    setLocation,
    normalizedRouteId,
    hasInvalidRouteId,
    isMe,
  };
}
