import type { CompanionInfoArticle } from "@/features/edge-companion/companion-surfaces/types";
import { TEMPLATE_PAGE_PADDING_TOP } from "./template-layout";
import type { InteractiveTemplateNav } from "./interactive-template-nav";

const PT = TEMPLATE_PAGE_PADDING_TOP;

const RULES = [
  {
    icon: "👆",
    title: "Тапай на персонажа",
    desc: "Каждый успешный тап начисляет XP на сервере. Следи за подсказками и паузой между тапами.",
  },
  {
    icon: "📋",
    title: "Выполняй шаги квеста",
    desc: "На экране игры — 3 шага: 25, 75 и 150 тапов за сессию. Это визуальный прогресс в макете.",
  },
  {
    icon: "📈",
    title: "Набирай уровни",
    desc: "Уровень и XP приходят с сервера EDGE и отображаются в игре и рейтинге.",
  },
  {
    icon: "🎰",
    title: "Розыгрыш призов",
    desc: "Правила конкретной кампании — у организатора и в блоке «Розыгрыш».",
  },
  {
    icon: "🚫",
    title: "Честная игра",
    desc: "Запрещены боты и злоупотребления. Организатор может дисквалифицировать нарушителей.",
  },
];

function ImageCard({ emoji, label, color }: { emoji: string; label: string; color: string }) {
  return (
    <div
      style={{
        flex: "0 0 calc(50% - 6px)",
        background: `linear-gradient(135deg,rgba(${color},0.2),rgba(${color},0.06))`,
        border: `1px solid rgba(${color},0.25)`,
        borderRadius: 16,
        padding: "20px 12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        boxShadow: `0 0 24px rgba(${color},0.1)`,
      }}
    >
      <div style={{ fontSize: 40 }}>{emoji}</div>
      <div style={{ color: `rgba(${color},0.9)`, fontWeight: 700, fontSize: 12, textAlign: "center" }}>{label}</div>
    </div>
  );
}

export function InteractiveTemplateRulesPage({
  article,
  nav,
}: {
  article: CompanionInfoArticle | null;
  nav: InteractiveTemplateNav;
}) {
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
      <div style={{ flexShrink: 0, padding: `${PT + 12}px 20px 16px` }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#f1f5f9", marginBottom: 4 }}>📖 Правила</div>
        <div style={{ color: "rgba(180,195,220,0.5)", fontSize: 13 }}>Как участвовать в интерактиве</div>
      </div>

      <div style={{ display: "flex", gap: 12, padding: "0 16px 20px", flexWrap: "wrap" }}>
        <ImageCard emoji="🐣" label="Тапай питомца" color="139,92,246" />
        <ImageCard emoji="⭐" label="Набирай XP" color="245,158,11" />
        <ImageCard emoji="🏆" label="Попади в топ" color="59,130,246" />
        <ImageCard emoji="🎁" label="Выиграй приз" color="16,185,129" />
      </div>

      <div style={{ padding: "0 16px", flex: 1 }}>
        {article?.title ? (
          <div style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 16, marginBottom: 12 }}>{article.title}</div>
        ) : null}
        {article?.blocks?.map((b, i) => {
          if (b.type === "paragraph") {
            return (
              <p
                key={i}
                style={{ color: "rgba(196,181,253,0.85)", fontSize: 13, lineHeight: 1.65, margin: "0 0 12px" }}
              >
                {b.text}
              </p>
            );
          }
          if (b.type === "image") {
            return (
              <img
                key={i}
                src={b.url}
                alt={b.alt ?? ""}
                style={{ width: "100%", borderRadius: 14, marginBottom: 12 }}
              />
            );
          }
          if (b.type === "video") {
            return (
              <video
                key={i}
                src={b.url}
                controls
                style={{ width: "100%", borderRadius: 14, marginBottom: 12 }}
              />
            );
          }
          return null;
        })}

        {RULES.map((r, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 12,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 14,
              padding: "12px 14px",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                flexShrink: 0,
                background: "rgba(124,58,237,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              {r.icon}
            </div>
            <div>
              <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{r.title}</div>
              <div style={{ color: "rgba(180,195,220,0.5)", fontSize: 12, lineHeight: 1.55 }}>{r.desc}</div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => nav.goToCharacter()}
          style={{
            width: "100%",
            marginTop: 8,
            marginBottom: 24,
            background: "linear-gradient(135deg,#7c3aed,#6366f1)",
            border: "none",
            borderRadius: 18,
            padding: "16px",
            color: "white",
            fontWeight: 800,
            fontSize: 16,
            cursor: "pointer",
            boxShadow: "0 8px 32px rgba(124,58,237,0.45)",
          }}
        >
          🎮 Начать играть
        </button>
      </div>
    </div>
  );
}
