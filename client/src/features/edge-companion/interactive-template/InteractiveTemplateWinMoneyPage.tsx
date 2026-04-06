import { useQuery } from "@tanstack/react-query";
import { fetchEdgeLeaderboard, type EdgeLeaderboardEntry } from "@/lib/edge-participant";
import type { ResultsLivePayload } from "@/lib/edge-gamification";
import { giftTitle } from "./gift-helpers";
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
    ? "rgba(251,191,36,0.1)"
    : r === 2
      ? "rgba(148,163,184,0.07)"
      : r === 3
        ? "rgba(184,115,51,0.09)"
        : "transparent";

type RowEntry = { rank: number; name: string; avatar: string; xp: number };

function Row({ entry, highlight = false, maxXp }: { entry: RowEntry; highlight?: boolean; maxXp: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        borderRadius: 13,
        marginBottom: 6,
        background: highlight ? "rgba(124,58,237,0.18)" : rankBg(entry.rank),
        border: `1px solid ${highlight ? "rgba(124,58,237,0.4)" : "transparent"}`,
      }}
    >
      <div
        style={{
          width: 24,
          minWidth: 24,
          textAlign: "center",
          fontWeight: 900,
          fontSize: 12,
          color: rankColor(entry.rank),
        }}
      >
        {entry.rank}
      </div>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          flexShrink: 0,
          background: highlight ? "linear-gradient(135deg,#7c3aed,#6366f1)" : "rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: entry.avatar.length <= 2 ? 10 : 16,
          boxShadow: highlight ? "0 0 12px rgba(124,58,237,0.6)" : "none",
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
            fontSize: 12,
            marginBottom: 3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.name}
        </div>
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 3, height: 3, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${maxXp > 0 ? (entry.xp / maxXp) * 100 : 0}%`,
              background: highlight
                ? "linear-gradient(90deg,#7c3aed,#a78bfa)"
                : "linear-gradient(90deg,rgba(139,92,246,0.55),rgba(99,102,241,0.35))",
              borderRadius: 3,
            }}
          />
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ color: highlight ? "#c4b5fd" : "rgba(196,181,253,0.55)", fontWeight: 800, fontSize: 13 }}>
          {entry.xp}
        </div>
        <div style={{ color: "rgba(180,195,220,0.25)", fontSize: 10 }}>XP</div>
      </div>
    </div>
  );
}

function formatDrawHint(iso: string | null | undefined): string {
  if (!iso) return "Дата розыгрыша уточняется у организатора.";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "Дата розыгрыша уточняется у организатора.";
  return t.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export function InteractiveTemplateWinMoneyPage({
  edgeId,
  giftTemplates,
  resultsLive,
  scheduleEndsAt,
  nav,
}: {
  edgeId: string;
  giftTemplates: unknown[];
  resultsLive: ResultsLivePayload | null;
  scheduleEndsAt: string | null | undefined;
  nav: InteractiveTemplateNav;
}) {
  const q = useQuery({
    queryKey: ["edge", "participant", "leaderboard", edgeId, "primary"],
    queryFn: () => fetchEdgeLeaderboard(edgeId, 30, "primary"),
  });
  const data = q.data;
  const entries = data?.entries ?? [];
  const total = data?.totalParticipants ?? 0;
  const giftCount = Math.max(1, giftTemplates.length);
  const winChance = total > 0 ? ((giftCount / total) * 100).toFixed(2) : "—";

  const board: RowEntry[] = entries.slice(0, 10).map((e) => ({
    rank: e.rank,
    name: e.displayName?.trim() || (e.isMe ? "Вы" : `Участник ${e.rank}`),
    avatar: avatarFor(e),
    xp: e.xp,
  }));
  const maxXp = board[0]?.xp ?? 1;
  const meEntry = entries.find((e) => e.isMe);
  const me: RowEntry | null = meEntry
    ? { rank: meEntry.rank, name: "Вы", avatar: "🐣", xp: meEntry.xp }
    : data?.myRank != null
      ? { rank: data.myRank, name: "Вы", avatar: "🐣", xp: 0 }
      : null;

  const t1 = giftTemplates[0] ? giftTitle(giftTemplates[0]) : "Призы кампании";
  const t2 = giftTemplates[1] ? giftTitle(giftTemplates[1]) : null;

  const drawLine = resultsLive?.drawnAt
    ? `Последний розыгрыш: ${new Date(resultsLive.drawnAt).toLocaleString("ru-RU")}`
    : `Розыгрыш: ${formatDrawHint(scheduleEndsAt)}`;

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100%",
        background: "#060b18",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter',-apple-system,sans-serif",
        overflowY: "auto",
      }}
    >
      <div style={{ flexShrink: 0, padding: `${PT + 12}px 20px 0` }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#f1f5f9", marginBottom: 6 }}>💰 Выиграть деньги</div>
        <div style={{ color: "rgba(180,195,220,0.55)", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
          Участвуй в интерактиве, выполняй задания и получи шанс выиграть приз из фонда кампании!
        </div>
      </div>

      <div
        style={{
          margin: "0 16px 20px",
          background: "linear-gradient(135deg,rgba(124,58,237,0.25),rgba(99,102,241,0.15))",
          borderRadius: 20,
          padding: "18px 20px",
          border: "1px solid rgba(124,58,237,0.3)",
          boxShadow: "0 0 40px rgba(124,58,237,0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 42 }}>🏆</div>
          <div>
            <div
              style={{
                color: "rgba(196,181,253,0.6)",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                marginBottom: 4,
              }}
            >
              Призовой фонд
            </div>
            <div style={{ color: "#f1f5f9", fontWeight: 900, fontSize: 20, lineHeight: 1.2 }}>{t1}</div>
            {t2 ? <div style={{ color: "#fbbf24", fontWeight: 800, fontSize: 18 }}>+ {t2}</div> : null}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        <div
          style={{
            color: "rgba(180,195,220,0.4)",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1.5,
            marginBottom: 12,
          }}
        >
          Как победить
        </div>
        {[
          { icon: "🎮", title: "Играй и тапай", desc: "Нажимай на персонажа и набирай XP. Чем больше активности — тем выше в рейтинге." },
          { icon: "✅", title: "Выполняй задания", desc: "Задания кампании дают бонусный XP." },
          { icon: "👥", title: "Приглашай друзей", desc: "Если в кампании есть реферальное задание — выполни его в разделе заданий." },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 14,
              marginBottom: 14,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 16,
              padding: "14px 16px",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                flexShrink: 0,
                background: "rgba(124,58,237,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
              }}
            >
              {s.icon}
            </div>
            <div>
              <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                <span style={{ color: "rgba(196,181,253,0.45)", marginRight: 6 }}>{i + 1}.</span>
                {s.title}
              </div>
              <div style={{ color: "rgba(180,195,220,0.5)", fontSize: 12, lineHeight: 1.55 }}>{s.desc}</div>
            </div>
          </div>
        ))}

        <div
          style={{
            background: "rgba(245,158,11,0.08)",
            borderRadius: 14,
            padding: "12px 16px",
            border: "1px solid rgba(245,158,11,0.2)",
            marginBottom: 20,
          }}
        >
          <div style={{ color: "rgba(251,191,36,0.8)", fontSize: 12, lineHeight: 1.6 }}>⏰ {drawLine}</div>
        </div>

        <button
          type="button"
          onClick={() => nav.goToTasks()}
          style={{
            width: "100%",
            background: "linear-gradient(135deg,#7c3aed,#6366f1)",
            border: "none",
            borderRadius: 18,
            padding: "16px",
            color: "white",
            fontWeight: 800,
            fontSize: 16,
            cursor: "pointer",
            boxShadow: "0 8px 32px rgba(124,58,237,0.45)",
            marginBottom: 28,
          }}
        >
          ✅ Выполнить задания
        </button>
      </div>

      <div style={{ padding: "0 14px 28px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              color: "rgba(180,195,220,0.4)",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1.5,
            }}
          >
            🏆 Рейтинг участников
          </div>
          <button
            type="button"
            onClick={() => nav.goToLeaderboardPrimary()}
            style={{
              background: "none",
              border: "none",
              color: "rgba(139,92,246,0.7)",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Все →
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[
            { label: "Игроков", value: total || "—", color: "#60a5fa" },
            { label: "Призов", value: giftTemplates.length || "—", color: "#fbbf24" },
            { label: "Ваш шанс", value: `${winChance}%`, color: "#34d399" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.04)",
                borderRadius: 12,
                padding: "9px 6px",
                textAlign: "center",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ color: s.color, fontWeight: 900, fontSize: 16, lineHeight: 1 }}>{s.value}</div>
              <div style={{ color: "rgba(180,195,220,0.35)", fontSize: 10, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {q.isLoading ? (
          <div style={{ color: "rgba(180,195,220,0.45)", textAlign: "center", padding: 16 }}>Загрузка…</div>
        ) : (
          <>
            {board.slice(0, 5).map((e) => (
              <Row key={e.rank} entry={e} maxXp={maxXp} />
            ))}
            <div
              style={{
                textAlign: "center",
                color: "rgba(180,195,220,0.18)",
                fontSize: 12,
                padding: "4px 0 8px",
                letterSpacing: 4,
              }}
            >
              · · ·
            </div>
            {me ? (
              <>
                <div
                  style={{
                    color: "rgba(180,195,220,0.3)",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1.2,
                    marginBottom: 6,
                    textAlign: "center",
                  }}
                >
                  Ваше место
                </div>
                <Row entry={me} highlight maxXp={maxXp} />
                <div style={{ textAlign: "center", marginTop: 10, color: "rgba(180,195,220,0.3)", fontSize: 11 }}>
                  Шанс на победу: <span style={{ color: "#34d399", fontWeight: 700 }}>{winChance}%</span>
                  <span style={{ color: "rgba(180,195,220,0.2)" }}>
                    {" "}
                    ({giftCount} из {total || "—"})
                  </span>
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
