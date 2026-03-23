import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  fetchParserUsers,
  fetchVkParserBindings,
  fetchVkParserItems,
  type AdminVkParserBinding,
} from "@/lib/admin";
import { QK_BINDINGS, QK_QUEUE, QUEUE_PAGE_SIZE } from "./constants";

export function useVkParserData(createOpen: boolean, editBinding: AdminVkParserBinding | null) {
  const [userSearch, setUserSearch] = useState("");
  const [platformUserId, setPlatformUserId] = useState("");
  const [vkAccessToken, setVkAccessToken] = useState("");
  const [vkOwnerId, setVkOwnerId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [parseIntervalMinutes, setParseIntervalMinutes] = useState("30");
  const [postsPerRun, setPostsPerRun] = useState("5");
  const [requireModeration, setRequireModeration] = useState(true);
  const [visibility, setVisibility] = useState<"public" | "followers">("public");
  const [cityLine, setCityLine] = useState("");
  const [enabled, setEnabled] = useState(true);

  const [queueStatusFilter, setQueueStatusFilter] = useState<string>("pending_review");
  const [queueBindingFilter, setQueueBindingFilter] = useState<string>("");
  const [queuePage, setQueuePage] = useState(0);

  const {
    data: bindings = [],
    isLoading: bindingsLoading,
    isFetching: bindingsFetching,
    isError: bindingsError,
    refetch: refetchBindings,
  } = useQuery({
    queryKey: QK_BINDINGS,
    queryFn: fetchVkParserBindings,
  });

  useEffect(() => {
    setQueuePage(0);
  }, [queueStatusFilter, queueBindingFilter]);

  const {
    data: queueData,
    isLoading: queueLoading,
    isFetching: queueFetching,
    isError: queueError,
    refetch: refetchQueue,
  } = useQuery({
    queryKey: [...QK_QUEUE, queueStatusFilter, queueBindingFilter, queuePage, QUEUE_PAGE_SIZE] as const,
    queryFn: () =>
      fetchVkParserItems({
        status: queueStatusFilter || undefined,
        bindingId: queueBindingFilter || undefined,
        limit: QUEUE_PAGE_SIZE,
        offset: queuePage * QUEUE_PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const queue = queueData?.items ?? [];
  const queueTotal = queueData?.total ?? 0;
  const queueTotalPages = Math.max(1, Math.ceil(queueTotal / QUEUE_PAGE_SIZE));
  const queueFrom = queueTotal === 0 ? 0 : queuePage * QUEUE_PAGE_SIZE + 1;
  const queueTo = queueTotal === 0 ? 0 : queuePage * QUEUE_PAGE_SIZE + queue.length;

  const { data: users = [] } = useQuery({
    queryKey: ["admin", "vk-parser-users", userSearch],
    queryFn: () => fetchParserUsers(userSearch),
    enabled: createOpen || !!editBinding,
  });

  const resetForm = () => {
    setPlatformUserId("");
    setVkAccessToken("");
    setVkOwnerId("");
    setDisplayName("");
    setParseIntervalMinutes("30");
    setPostsPerRun("5");
    setRequireModeration(true);
    setVisibility("public");
    setCityLine("");
    setEnabled(true);
    setUserSearch("");
  };

  const fillFormFromBinding = (b: AdminVkParserBinding) => {
    setPlatformUserId(b.platformUserId);
    setVkAccessToken("");
    setVkOwnerId(b.vkOwnerId);
    setDisplayName(b.displayName ?? "");
    setParseIntervalMinutes(String(b.parseIntervalMinutes));
    setPostsPerRun(String(b.postsPerRun));
    setRequireModeration(b.requireModeration);
    setVisibility(b.visibility === "followers" ? "followers" : "public");
    setCityLine(b.cityLine ?? "");
    setEnabled(b.enabled);
  };

  const bindingLabel = useMemo(() => new Map(bindings.map((b) => [b.id, b.displayName || b.vkOwnerId])), [bindings]);

  return {
    userSearch,
    setUserSearch,
    platformUserId,
    setPlatformUserId,
    vkAccessToken,
    setVkAccessToken,
    vkOwnerId,
    setVkOwnerId,
    displayName,
    setDisplayName,
    parseIntervalMinutes,
    setParseIntervalMinutes,
    postsPerRun,
    setPostsPerRun,
    requireModeration,
    setRequireModeration,
    visibility,
    setVisibility,
    cityLine,
    setCityLine,
    enabled,
    setEnabled,
    queueStatusFilter,
    setQueueStatusFilter,
    queueBindingFilter,
    setQueueBindingFilter,
    queuePage,
    setQueuePage,
    bindings,
    bindingsLoading,
    bindingsFetching,
    bindingsError,
    refetchBindings,
    queue,
    queueTotal,
    queueTotalPages,
    queueFrom,
    queueTo,
    queueLoading,
    queueFetching,
    queueError,
    refetchQueue,
    users,
    resetForm,
    fillFormFromBinding,
    bindingLabel,
  };
}
