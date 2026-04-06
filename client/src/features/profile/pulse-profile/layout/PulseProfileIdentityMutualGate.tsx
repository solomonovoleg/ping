import { memo } from "react";
import { PulseProfileMutualFollowersRow } from "./PulseProfileMutualFollowersRow";
import type { PulseProfileMutualFollowersModel } from "./types";

type Props = {
  data: PulseProfileMutualFollowersModel | null;
};

export const PulseProfileIdentityMutualGate = memo(function PulseProfileIdentityMutualGate({ data }: Props) {
  if (!data || data.count <= 0) return null;
  return <PulseProfileMutualFollowersRow data={data} />;
});
