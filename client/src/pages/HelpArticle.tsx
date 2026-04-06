import { useParams } from "wouter";
import HelpInviteFriends from "@/pages/HelpInviteFriends";
import HelpInstallApp from "@/pages/help/HelpInstallApp";
import { HelpGeneric } from "@/pages/help/HelpGeneric";
import { HelpArticleChrome } from "@/pages/help/HelpArticleChrome";

export default function HelpArticle() {
  const params = useParams<{ slug: string }>();
  const slug = (params.slug ?? "").trim().toLowerCase();

  if (!slug) {
    return (
      <HelpArticleChrome title="Справка">
        <p className="py-8 text-center text-sm text-muted-foreground">Откройте нужный раздел из настроек.</p>
      </HelpArticleChrome>
    );
  }

  if (slug === "invite-friends") return <HelpInviteFriends />;
  if (slug === "install-app") return <HelpInstallApp />;
  return <HelpGeneric slug={slug} />;
}
