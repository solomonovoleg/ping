import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { TEMPLATE_PAGE_PADDING_TOP } from "./template-layout";
import type { InteractiveTemplateNav } from "./interactive-template-nav";

const PT = TEMPLATE_PAGE_PADDING_TOP;

export function InteractiveTemplateFriendsPage({
  campaignTitle,
  nav,
}: {
  campaignTitle: string;
  nav: InteractiveTemplateNav;
}) {
  const { toast } = useToast();

  const invite = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `Присоединяйся к кампании «${campaignTitle.slice(0, 80)}»`;
    try {
      if (navigator.share) {
        await navigator.share({ title: campaignTitle, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast({ title: "Ссылка скопирована", description: "Отправь её другу в мессенджере." });
    } catch {
      toast({ title: "Не удалось поделиться", description: "Скопируй ссылку из адресной строки.", variant: "destructive" });
    }
  }, [campaignTitle, toast]);

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
        <div style={{ fontSize: 22, fontWeight: 900, color: "#f1f5f9", marginBottom: 4 }}>👥 Друзья</div>
        <div style={{ color: "rgba(180,195,220,0.5)", fontSize: 13 }}>Зови друзей в PING — играйте вместе</div>
      </div>

      <div style={{ flex: 1, padding: "0 16px 24px" }}>
        <div
          style={{
            background: "linear-gradient(135deg,rgba(124,58,237,0.2),rgba(99,102,241,0.1))",
            borderRadius: 20,
            padding: "20px",
            border: "1px solid rgba(124,58,237,0.3)",
            marginBottom: 20,
            boxShadow: "0 0 40px rgba(124,58,237,0.08)",
          }}
        >
          <div style={{ fontSize: 40, textAlign: "center", marginBottom: 10 }}>🎉</div>
          <div style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 16, textAlign: "center", marginBottom: 6 }}>
            Пригласи друга
          </div>
          <div style={{ color: "rgba(196,181,253,0.6)", fontSize: 12, textAlign: "center", lineHeight: 1.6, marginBottom: 16 }}>
            Поделись кампанией. Если в заданиях есть «пригласить друзей» — выполни его отдельно в разделе заданий.
          </div>
          <button
            type="button"
            onClick={() => void invite()}
            style={{
              width: "100%",
              background: "linear-gradient(135deg,#7c3aed,#6366f1)",
              border: "none",
              borderRadius: 14,
              padding: "13px",
              color: "white",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 6px 24px rgba(124,58,237,0.4)",
            }}
          >
            🔗 Пригласить друга
          </button>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            borderRadius: 14,
            padding: "16px",
            border: "1px dashed rgba(255,255,255,0.08)",
            textAlign: "center",
            marginTop: 8,
          }}
        >
          <div style={{ color: "rgba(180,195,220,0.3)", fontSize: 13, marginBottom: 10 }}>Смотри общий рейтинг</div>
          <button
            type="button"
            onClick={() => nav.goToLeaderboardPrimary()}
            style={{
              background: "transparent",
              border: "1px solid rgba(124,58,237,0.35)",
              borderRadius: 12,
              padding: "9px 20px",
              color: "#c4b5fd",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            🏆 Открыть рейтинг
          </button>
        </div>
      </div>
    </div>
  );
}
