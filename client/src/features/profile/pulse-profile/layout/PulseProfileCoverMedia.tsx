import { memo } from "react";
import { pulseProfileCoverParallaxY } from "./pulse-profile-cover-parallax";

type Props = {
  coverUrl: string | null;
  onCoverError: () => void;
  scrollY: number;
  isDark: boolean;
  accent: string;
};

const coverLayerGeometry = {
  height: "calc(100% + 56px)",
  top: -28,
  willChange: "transform" as const,
};

export const PulseProfileCoverMedia = memo(function PulseProfileCoverMedia({
  coverUrl,
  onCoverError,
  scrollY,
  isDark,
  accent,
}: Props) {
  const translateY = pulseProfileCoverParallaxY(scrollY);
  const parallaxTransform = `translateY(${translateY}px)`;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          className="absolute w-full"
          style={{
            ...coverLayerGeometry,
            objectFit: "cover",
            objectPosition: "center 30%",
            transform: parallaxTransform,
          }}
          onError={onCoverError}
        />
      ) : (
        <div
          className="absolute w-full"
          style={{
            ...coverLayerGeometry,
            transform: parallaxTransform,
            background: isDark
              ? `radial-gradient(ellipse 80% 120% at 50% 20%, ${accent}35 0%, #0a0a18 55%)`
              : `radial-gradient(ellipse 80% 120% at 50% 20%, ${accent}28 0%, #e8ecfb 55%)`,
          }}
        />
      )}
    </div>
  );
});
