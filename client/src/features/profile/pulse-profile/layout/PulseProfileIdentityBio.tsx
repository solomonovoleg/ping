import { memo } from "react";

type Props = {
  text: string;
  textColor: string;
  marginTop: number;
};

export const PulseProfileIdentityBio = memo(function PulseProfileIdentityBio({ text, textColor, marginTop }: Props) {
  return (
    <p
      style={{
        fontSize: 14,
        color: textColor,
        lineHeight: 1.62,
        marginTop,
        letterSpacing: "0.002em",
        fontWeight: 400,
      }}
    >
      {text}
    </p>
  );
});
