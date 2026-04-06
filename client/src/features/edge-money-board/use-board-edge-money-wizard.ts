import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  createEdgeCampaignDraft,
  fetchEdgeCampaignDetail,
  patchEdgeCampaign,
  edgeCreatorDestructiveToast,
} from "@/lib/edge-creator";
import {
  MONEY_WIZARD_STEPS,
  hydrateMoneyHeadlineMedia,
  hydrateMoneyInviteDm,
  hydrateMoneyScoringCards,
  hydrateMoneyTiers,
  cardsToMoneyScoringPatch,
  inviteDmToMoneyPatch,
  tiersToMoneyPatch,
  type MoneyScoringCardState,
  type MoneyTierFormRow,
} from "@/lib/edge-money-wizard";

function parseSearchEdgeId(search: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  try {
    return new URLSearchParams(raw).get("edgeId")?.trim() ?? "";
  } catch {
    return "";
  }
}

function readCfg(cfg: unknown): Record<string, unknown> {
  return cfg && typeof cfg === "object" && !Array.isArray(cfg) ? (cfg as Record<string, unknown>) : {};
}

export function useBoardEdgeMoneyWizard() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const qc = useQueryClient();
  const edgeIdParam = useMemo(() => parseSearchEdgeId(search), [search]);

  const [step, setStep] = useState(0);
  const [campaignTitle, setCampaignTitle] = useState("");
  const [headline, setHeadline] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [cards, setCards] = useState<MoneyScoringCardState[]>(() => hydrateMoneyScoringCards({}));
  const [tiers, setTiers] = useState<MoneyTierFormRow[]>([]);
  const [drawSummary, setDrawSummary] = useState("");
  const [resetSummary, setResetSummary] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [displayAudience, setDisplayAudience] = useState<"self" | "followers" | "public">("public");
  const [leaderboardPrimaryEnabled, setLeaderboardPrimaryEnabled] = useState(false);
  const [leaderboardSecondaryEnabled, setLeaderboardSecondaryEnabled] = useState(true);
  const [inviteDmTemplate, setInviteDmTemplate] = useState("");
  const [inviteDmHours, setInviteDmHours] = useState(168);
  const [colorScheme, setColorScheme] = useState<"default" | "gold" | "emerald" | "rose" | "violet" | "cyan">("default");

  const hydratedFor = useRef("");

  const detailQ = useQuery({
    queryKey: ["edge", "creator", "detail", edgeIdParam],
    queryFn: () => fetchEdgeCampaignDetail(edgeIdParam),
    enabled: Boolean(edgeIdParam),
    retry: 1,
  });

  useEffect(() => {
    const d = detailQ.data;
    if (!d || hydratedFor.current === d.edgeId) return;
    if (d.edgeType !== "money") {
      toast({
        title: "Это не EDGE MONEY",
        description: "Открыт редактор для другого типа кампании.",
        variant: "destructive",
      });
      setLocation(`/board/edge/new?edgeId=${encodeURIComponent(d.edgeId)}`);
      return;
    }
    hydratedFor.current = d.edgeId;
    setCampaignTitle(d.title);
    const hm = hydrateMoneyHeadlineMedia(d.configJson);
    setHeadline(hm.headline);
    setMediaUrl(hm.mediaUrl);
    setColorScheme(hm.colorScheme);
    setCards(hydrateMoneyScoringCards(d.configJson));
    setTiers(hydrateMoneyTiers(d.configJson));
    const idm = hydrateMoneyInviteDm(d.configJson);
    setInviteDmTemplate(idm.template);
    setInviteDmHours(idm.codeExpiresInHours);
    setLeaderboardPrimaryEnabled(d.leaderboardPrimaryEnabled ?? false);
    setLeaderboardSecondaryEnabled(d.leaderboardSecondaryEnabled ?? true);
    const root = readCfg(d.configJson);
    const sch = readCfg(root.schedule);
    setDrawSummary(typeof sch.drawSummary === "string" ? sch.drawSummary : "");
    setResetSummary(typeof sch.leaderboardResetSummary === "string" ? sch.leaderboardResetSummary : "");
    const ea = sch.endsAt;
    if (typeof ea === "string" && ea) setEndsAt(ea.slice(0, 10));
    const da = root.displayAudience;
    if (da === "self" || da === "followers" || da === "public") setDisplayAudience(da);
    const sk = `edgeMoneyWizard:${d.edgeId}:step`;
    const saved = sessionStorage.getItem(sk);
    const n = saved ? Number.parseInt(saved, 10) : NaN;
    setStep(Number.isFinite(n) && n >= 1 && n <= MONEY_WIZARD_STEPS.length - 1 ? n : 1);
  }, [detailQ.data, setLocation, toast]);

  useEffect(() => {
    if (!edgeIdParam) return;
    sessionStorage.setItem(`edgeMoneyWizard:${edgeIdParam}:step`, String(step));
  }, [edgeIdParam, step]);

  const savePatch = useCallback(
    async (partial: Parameters<typeof patchEdgeCampaign>[1]) => {
      if (!edgeIdParam) return;
      await patchEdgeCampaign(edgeIdParam, partial);
      void qc.invalidateQueries({ queryKey: ["edge", "my-campaigns"] });
      void qc.invalidateQueries({ queryKey: ["edge", "creator", "detail", edgeIdParam] });
    },
    [edgeIdParam, qc],
  );

  const createMut = useMutation({
    mutationFn: () =>
      createEdgeCampaignDraft({
        title: campaignTitle.trim() || "EDGE MONEY",
        edgeType: "money",
      }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["edge", "my-campaigns"] });
      toast({ title: "Черновик EDGE MONEY" });
      sessionStorage.setItem(`edgeMoneyWizard:${data.edgeId}:step`, "1");
      setLocation(`/board/edge/new-money?edgeId=${encodeURIComponent(data.edgeId)}`);
    },
    onError: (e) => toast({ ...edgeCreatorDestructiveToast(e), variant: "destructive" }),
  });

  const publishMut = useMutation({
    mutationFn: () => savePatch({ status: "published" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["edge", "my-campaigns"] });
      toast({
        title: "Кампания опубликована",
        description: "Создайте пост — без него игра не появится в ленте.",
      });
      if (edgeIdParam) setLocation(`/create-post?edgeId=${encodeURIComponent(edgeIdParam)}`);
    },
    onError: (e) => toast({ ...edgeCreatorDestructiveToast(e), variant: "destructive" }),
  });

  async function goNext() {
    if (!edgeIdParam && step === 0) {
      createMut.mutate();
      return;
    }
    if (!edgeIdParam) return;
    try {
      if (step === 1) {
        await savePatch({
          moneyConfig: {
            headline: headline.trim(),
            mediaUrl: mediaUrl.trim() || null,
            colorScheme,
          },
        });
      }
      if (step === 2) {
        const inviteFriendOn = cards.some((c) => c.kind === "invite_friend" && c.enabled);
        const inviteDm =
          inviteFriendOn && inviteDmTemplate.trim()
            ? inviteDmToMoneyPatch(inviteDmTemplate, inviteDmHours)
            : null;
        await savePatch({
          moneyConfig: {
            scoringRules: cardsToMoneyScoringPatch(cards),
            inviteDm,
          },
        });
      }
      if (step === 3) {
        const valid = tiers.filter((t) => t.label.trim() && t.fromRank >= 1 && t.toRank >= t.fromRank);
        await savePatch({ moneyConfig: { prizeTiers: tiersToMoneyPatch(valid) } });
      }
      if (step === 4) {
        await savePatch({ leaderboardPrimaryEnabled, leaderboardSecondaryEnabled });
      }
      if (step === 5) {
        await savePatch({
          schedule: {
            drawSummary: drawSummary.trim(),
            leaderboardResetSummary: resetSummary.trim(),
            endsAt: endsAt.trim() ? new Date(`${endsAt}T23:59:59`).toISOString() : null,
          },
          displayAudience,
        });
      }
      setStep((s) => Math.min(MONEY_WIZARD_STEPS.length - 1, s + 1));
      toast({ title: "Сохранено" });
    } catch (e) {
      toast({ ...edgeCreatorDestructiveToast(e), variant: "destructive" });
    }
  }

  const isBusy = createMut.isPending || detailQ.isLoading;
  const stepLabel = MONEY_WIZARD_STEPS[step] ?? "";

  return {
    setLocation,
    edgeIdParam,
    step,
    setStep,
    stepLabel,
    isBusy,
    detailQ,
    campaignTitle,
    setCampaignTitle,
    headline,
    setHeadline,
    mediaUrl,
    setMediaUrl,
    colorScheme,
    setColorScheme,
    cards,
    setCards,
    tiers,
    setTiers,
    drawSummary,
    setDrawSummary,
    resetSummary,
    setResetSummary,
    endsAt,
    setEndsAt,
    displayAudience,
    setDisplayAudience,
    leaderboardPrimaryEnabled,
    setLeaderboardPrimaryEnabled,
    leaderboardSecondaryEnabled,
    setLeaderboardSecondaryEnabled,
    inviteDmTemplate,
    setInviteDmTemplate,
    inviteDmHours,
    setInviteDmHours,
    goNext,
    createMut,
    publishMut,
  };
}
