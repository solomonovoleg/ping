import { usePulseProfileTheme } from "@/features/profile/pulse-profile";

export function PulseProfileCaption({ children }: { children: string }) {
  const { th } = usePulseProfileTheme();
  return (
    <p
      className="whitespace-pre-wrap text-[15px] font-normal leading-snug tracking-[-0.01em]"
      style={{ color: th.text }}
    >
      {children}
    </p>
  );
}
