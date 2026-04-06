import { useQuery } from "@tanstack/react-query";
import { fetchEdgeLeaderboard, type EdgeLeaderboardEntry } from "@/lib/edge-participant";
import { TEMPLATE_PAGE_PADDING_TOP } from "./template-layout";
import type { InteractiveTemplateNav } from "./interactive-template-nav";

const PT = TEMPLATE_PAGE_PADDING_TOP;

function avatarFor(e: EdgeLeaderboardEntry): string {
  if (e.isMe) return "🐣";
  const d = (e.displayName || "?").trim();
  if (!d) return "🧑";
  return d.length > 2 ? d.slice(0, 2).toUpperCase() : d.slice(0, 1).toUpperCase();
}

const rankColor = (r: number) =>
  r === 1 ? "#fbbf24" : r === 2 ? "#94a3b8" : r === 3 ? "#b87333" : "rgba(255,255,255,0.3)";
const rankBg = (r: number) =>
  r === 1
    ? "rgba(251,191,36,0.12)"
    : r === 2
      ? "rgba(148,163,184,0.08)"
      : r === 3
        ? "rgba(184,115,51,0.10)"
        : "transparent";

type RowEntry = { rank: number; name: string; avatar: string; xp: number };

function Row({ entry, highlight = false, maxXp }: { entry: RowEntry; highlight?: boolean; maxXp: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 14,
        marginBottom: 6,
        background: highlight ? "rgba(124,58,237,0.18)" : rankBg(entry.rank),
        border: highlight ? "1px solid rgba(124,58,237,0.4)" : "1px solid transparent",
      }}
    >
      <div
        style={{
          width: 26,
          minWidth: 26,
          textAlign: "center",
          fontWeight: 900,
          fontSize: 13,
          color: rankColor(entry.rank),
        }}
      >
        {entry.rank}
      </div>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: highlight ? "linear-gradient(135deg,#7c3aed,#6366f1)" : "rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: entry.avatar.length <= 2 ? 11 : 18,
          flexShrink: 0,
          boxShadow: highlight ? "0 0 14px rgba(124,58,237,0.6)" : "none",
          fontWeight: 800,
          color: highlight ? "#fff" : "#e2e8f0",
        }}
      >
        {entry.avatar}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "#f1f5f9",
            fontWeight: 700,
            fontSize: 13,
            marginBottom: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.name}
        </div>
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 4, height: 4, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${maxXp > 0 ? (entry.xp / maxXp) * 100 : 0}%`,
              background: highlight
                ? "linear-gradient(90deg,#7c3aed,#a78bfa)"
                : "linear-gradient(90deg,rgba(139,92,246,0.6),rgba(99,102,241,0.4))",
              borderRadius: 4,
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ color: highlight ? "#c4b5fd" : "rgba(196,181,253,0.6)", fontWeight: 800, fontSize: 14 }}>
          {entry.xp}
        </div>
        <div style={{ color: "rgba(180,195,220,0.3)", fontSize: 10 }}>XP</div>
      </div>
    </div>
  );
}

export function InteractiveTemplateLeaderboardPage({
  edgeId,
  kind,
  giftCount,
  nav,
  pageTitle,
}: {
  edgeId: string;
  kind: "primary" | "secondary";
  giftCount: number;
  nav: InteractiveTemplateNav;
  pageTitle: string;
}) {
  const q = useQuery({
    queryKey: ["edge", "participant", "leaderboard", edgeId, kind],
    queryFn: () => fetchEdgeLeaderboard(edgeId, 30, kind),
  });
  const data = q.data;
  const entries = data?.entries ?? [];
  const total = data?.totalParticipants ?? 0;
  const numPrizes = Math.max(1, giftCount);
  const winChance = total > 0 ? ((numPrizes / total) * 100).toFixed(2) : "—";

  const board: RowEntry[] = entries.slice(0, 10).map((e) => ({
    rank: e.rank,
    name: e.displayName?.trim() || (e.isMe ? "Вы" : `Участник ${e.rank}`),
    avatar: avatarFor(e),
    xp: e.xp,
  }));
  const maxXp = board[0]?.xp ?? 1;
  const meEntry = entries.find((e) => e.isMe);
  const me: RowEntry | null = meEntry
    ? {
        rank: meEntry.rank,
        name: "Вы",
        avatar: "🐣",
        xp: meEntry.xp,
      }
    : data?.myRank != null
      ? {
          rank: data.myRank,
          name: "Вы",
          avatar: "🐣",
          xp: 0,
        }
      : null;

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100%",
        background: "#060b18",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter',-apple-system,sans-serif",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          paddingTop: PT + 12,
          paddingBottom: 14,
          paddingLeft: 20,
          paddingRight: 20,
          background: "linear-gradient(180deg,rgba(6,11,24,0.8) 0%,transparent 100%)",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 900, color: "#f1f5f9", marginBottom: 4 }}>{pageTitle}</div>
        <div style={{ color: "rgba(180,195,220,0.5)", fontSize: 13, marginBottom: 14 }}>
          Топ участников по накопленным XP
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Игроков", value: total || "—", color: "#60a5fa" },
            { label: "Призов", value: giftCount || "—", color: "#fbbf24" },
            { label: "Ваш шанс", value: `${winChance}%`, color: "#34d399" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.045)",
                borderRadius: 12,
                padding: "10px 8px",
                textAlign: "center",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ color: s.color, fontWeight: 900, fontSize: 18, lineHeight: 1 }}>{s.value}</div>
              <div style={{ color: "rgba(180,195,220,0.4)", fontSize: 10, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 14px" }}>
        {q.isLoading ? (
          <div style={{ color: "rgba(180,195,220,0.45)", textAlign: "center", padding: 24 }}>Загрузка…</div>
        ) : q.isError ? (
          <div style={{ color: "#fca5a5", textAlign: "center", padding: 24 }}>
            Не удалось загрузить рейтинг
            <button
              type="button"
              onClick={() => void q.refetch()}
              style={{
                display: "block",
                margin: "16px auto 0",
                background: "rgba(124,58,237,0.3)",
                border: "none",
                borderRadius: 12,
                padding: "10px 20px",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Повторить
            </button>
          </div>
        ) : (
          <>
            {board.slice(0, 5).map((e) => (
              <Row key={e.rank} entry={e} maxXp={maxXp} />
            ))}
            <div
              style={{
                textAlign: "center",
                color: "rgba(180,195,220,0.2)",
                fontSize: 12,
                padding: "4px 0 4px",
                letterSpacing: 4,
              }}
            >
              · · ·
            </div>
            {board.slice(5).map((e) => (
              <Row key={e.rank} entry={e} maxXp={maxXp} />
            ))}
            {me ? (
              <div
                style={{
                  position: "sticky",
                  bottom: 0,
                  paddingBottom: 16,
                  paddingTop: 8,
                  background: "linear-gradient(0deg,#060b18 60%,transparent)",
                }}
              >
                <div
                  style={{
                    color: "rgba(180,195,220,0.35)",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                    marginBottom: 6,
                    textAlign: "center",
                  }}
                >
                  Ваше место
                </div>
                <Row entry={me} highlight maxXp={maxXp} />
                <div style={{ textAlign: "center", marginTop: 10, color: "rgba(180,195,220,0.35)", fontSize: 11 }}>
                  Шанс на победу:{" "}
                  <span style={{ color: "#34d399", fontWeight: 700 }}>{winChance}%</span>
                  <span style={{ color: "rgba(180,195,220,0.25)" }}>
                    {" "}
                    ({numPrizes} из {total || "—"})
                  </span>
                </div>
              </div>
            ) : null}
          </>
        )}

        <button
          type="button"
          onClick={() => nav.goToCharacter()}
          style={{
            width: "100%",
            marginTop: 12,
            marginBottom: 24,
            background: "linear-gradient(135deg,#7c3aed,#6366f1)",
            border: "none",
            borderRadius: 18,
            padding: "14px",
            color: "white",
            fontWeight: 800,
            fontSize: 15,
            cursor: "pointer",
            boxShadow: "0 8px 32px rgba(124,58,237,0.45)",
          }}
        >
          🎮 Играть
        </button>
      </div>
    </div>
  );
}
