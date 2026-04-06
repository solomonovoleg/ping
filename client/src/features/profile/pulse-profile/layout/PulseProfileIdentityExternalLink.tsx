import { memo } from "react";
import { Link } from "lucide-react";

type Props = {
  linkDisplay: string;
  linkHref: string;
  accent: string;
};

export const PulseProfileIdentityExternalLink = memo(function PulseProfileIdentityExternalLink({
  linkDisplay,
  linkHref,
  accent,
}: Props) {
  return (
    <a
      href={linkHref}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2.5 flex items-center gap-1.5 break-all"
    >
      <Link style={{ width: 12, height: 12, color: accent, flexShrink: 0 }} aria-hidden />
      <span style={{ fontSize: 12.5, color: accent, fontWeight: 600, lineHeight: 1.35 }}>{linkDisplay}</span>
    </a>
  );
});
