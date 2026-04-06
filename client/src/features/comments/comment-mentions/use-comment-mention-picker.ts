import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchUsers, type SearchUser } from "@/lib/search";
import type { ContactUser } from "@/lib/users";
import { parseAtTokenBeforeCursor } from "./parse-at-token";
import { buildMentionChunk } from "./build-mention-chunk";
import { fetchMentionSeedUsers } from "./fetch-mention-seed-users";

type Candidate = ContactUser;

function useDebounced<T>(value: T, ms: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return d;
}

function matchesQuery(u: Candidate, q: string): boolean {
  if (!q) return true;
  const low = q.toLowerCase();
  const name = [u.displayName, u.surname].filter(Boolean).join(" ").toLowerCase();
  if (name.includes(low)) return true;
  return String(u.publicId).startsWith(q);
}

function dedupeCandidates(primary: Candidate[], extra: SearchUser[], selfId: string | undefined): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const u of primary) {
    if (selfId && u.id === selfId) continue;
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    out.push(u);
  }
  for (const u of extra) {
    if (selfId && u.id === selfId) continue;
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    out.push({
      id: u.id,
      publicId: u.publicId,
      displayName: u.displayName,
      surname: u.surname,
      avatarUrl: u.avatarUrl,
    });
  }
  return out;
}

export function useCommentMentionPicker(opts: {
  value: string;
  onChange: (next: string) => void;
  enabled: boolean;
  currentUserId: string | undefined;
  selectionStart: number;
  applyCursor: (pos: number) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const at = useMemo(
    () => (opts.enabled ? parseAtTokenBeforeCursor(opts.value, opts.selectionStart) : null),
    [opts.value, opts.selectionStart, opts.enabled],
  );
  const open = at !== null;
  const query = at?.query ?? "";
  const debouncedQuery = useDebounced(query, 260);

  const { data: seeds = [] } = useQuery({
    queryKey: ["comments", "mention-seeds", opts.currentUserId],
    queryFn: () => fetchMentionSeedUsers(opts.currentUserId!),
    enabled: !!opts.currentUserId && opts.enabled,
    staleTime: 120_000,
  });

  const searchEnabled = open && debouncedQuery.trim().length >= 1;
  const { data: remote = [], isFetching } = useQuery({
    queryKey: ["comments", "mention-search", debouncedQuery.trim()],
    queryFn: () => searchUsers(debouncedQuery.trim()),
    enabled: searchEnabled,
    staleTime: 20_000,
  });

  const candidates = useMemo(() => {
    if (!open || !at) return [];
    const self = opts.currentUserId;
    const base = seeds.filter((u) => !self || u.id !== self);
    if (!query.trim()) return base.slice(0, 80);
    const seedHits = base.filter((u) => matchesQuery(u, query));
    const qd = debouncedQuery.trim();
    if (qd.length < 1) return seedHits.slice(0, 40);
    const remoteHits = remote.filter((u) => !self || u.id !== self);
    return dedupeCandidates(seedHits, remoteHits, self).slice(0, 40);
  }, [open, at, seeds, remote, query, debouncedQuery, opts.currentUserId]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, candidates.length, open]);

  const pick = useCallback(
    (u: Candidate) => {
      if (!at) return;
      const chunk = buildMentionChunk(u);
      const next = opts.value.slice(0, at.replaceFrom) + chunk + " " + opts.value.slice(at.replaceTo);
      opts.onChange(next);
      const pos = at.replaceFrom + chunk.length + 1;
      requestAnimationFrame(() => opts.applyCursor(pos));
    },
    [at, opts],
  );

  const moveSel = useCallback(
    (delta: number) => {
      if (candidates.length === 0) return;
      setSelectedIndex((i) => (i + delta + candidates.length) % candidates.length);
    },
    [candidates.length],
  );

  const cancelMention = useCallback(() => {
    if (!at) return;
    opts.onChange(opts.value.slice(0, at.replaceFrom) + opts.value.slice(at.replaceTo));
    requestAnimationFrame(() => opts.applyCursor(at.replaceFrom));
  }, [at, opts]);

  return {
    open,
    at,
    candidates,
    selectedIndex,
    setSelectedIndex,
    searching: isFetching && searchEnabled,
    pick,
    moveSel,
    cancelMention,
    topPickCount: 5,
  };
}
