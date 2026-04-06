import { useState } from "react";
import { giftDescription, giftGlowRgb, giftTitle } from "./gift-helpers";
import { TEMPLATE_PAGE_PADDING_TOP } from "./template-layout";
import type { InteractiveTemplateNav } from "./interactive-template-nav";

const PT = TEMPLATE_PAGE_PADDING_TOP;

const TAGS = ["Главный", "Денежный", "Сюрприз", "Приз"];
const TAG_COLORS = ["#fbbf24", "#34d399", "#a78bfa", "#60a5fa"];

export function InteractiveTemplatePrizesPage({
  giftTemplates,
  nav,
}: {
  giftTemplates: unknown[];
  nav: InteractiveTemplateNav;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!giftTemplates.length) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: "100%",
          background: "#060b18",
          fontFamily: "'Inter',-apple-system,sans-serif",
          padding: PT + 24,
          color: "rgba(180,195,220,0.55)",
          textAlign: "center",
        }}
      >
        Призы пока не настроены в кампании.
      </div>
    );
  }

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
        <div style={{ fontSize: 22, fontWeight: 900, color: "#f1f5f9", marginBottom: 4 }}>🎁 Призы</div>
        <div style={{ color: "rgba(180,195,220,0.5)", fontSize: 13 }}>Нажми на приз, чтобы узнать подробности</div>
      </div>

      <div style={{ flex: 1, padding: "0 16px 24px" }}>
        {giftTemplates.map((raw, i) => {
          const id = i + 1;
          const open = expanded === id;
          const title = giftTitle(raw);
          const desc = giftDescription(raw) || "Описание уточняйте у организатора кампании.";
          const glow = giftGlowRgb(i);
          const tag = TAGS[i % TAGS.length]!;
          const tagColor = TAG_COLORS[i % TAG_COLORS.length]!;
          return (
            <div
              key={id}
              role="button"
              tabIndex={0}
              onClick={() => setExpanded(open ? null : id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setExpanded(open ? null : id);
              }}
              style={{
                background: open ? `rgba(${glow},0.12)` : "rgba(255,255,255,0.03)",
                border: `1px solid ${open ? `rgba(${glow},0.4)` : "rgba(255,255,255,0.07)"}`,
                borderRadius: 18,
                padding: "16px",
                marginBottom: 12,
                cursor: "pointer",
                transition: "all 0.28s ease",
                boxShadow: open ? `0 0 28px rgba(${glow},0.2)` : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    flexShrink: 0,
                    background: `rgba(${glow},0.15)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                    boxShadow: open ? `0 0 20px rgba(${glow},0.4)` : "none",
                    transition: "box-shadow 0.3s",
                  }}
                >
                  🎁
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 15 }}>{title}</span>
                    <span
                      style={{
                        background: `rgba(${glow},0.2)`,
                        color: tagColor,
                        borderRadius: 8,
                        padding: "2px 8px",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {tag}
                    </span>
                  </div>
                  <div style={{ color: "rgba(180,195,220,0.5)", fontSize: 12 }}>Нажми, чтобы раскрыть</div>
                </div>
                <div
                  style={{
                    color: "rgba(180,195,220,0.35)",
                    fontSize: 18,
                    transform: open ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.25s ease",
                  }}
                >
                  ⌄
                </div>
              </div>

              {open && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <p style={{ color: "rgba(196,181,253,0.8)", fontSize: 13, lineHeight: 1.65, margin: "0 0 14px" }}>
                    {desc}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      nav.goToCharacter();
                    }}
                    style={{
                      background: `linear-gradient(135deg,rgba(${glow},0.85),rgba(${glow},0.5))`,
                      border: "none",
                      borderRadius: 12,
                      padding: "10px 20px",
                      color: "white",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    🎮 Играть за этот приз
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            borderRadius: 16,
            padding: "14px 16px",
            border: "1px solid rgba(255,255,255,0.06)",
            marginTop: 8,
          }}
        >
          <div
            style={{
              color: "rgba(180,195,220,0.4)",
              fontSize: 11,
              marginBottom: 8,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Условия розыгрыша
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {[
              ["—", "игроков"],
              [String(giftTemplates.length), "призовых"],
              ["—", "ваш шанс"],
            ].map(([v, l]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 16 }}>{v}</div>
                <div style={{ color: "rgba(180,195,220,0.35)", fontSize: 10 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
