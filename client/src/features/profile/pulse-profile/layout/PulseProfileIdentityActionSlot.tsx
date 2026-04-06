import { memo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export const PulseProfileIdentityActionSlot = memo(function PulseProfileIdentityActionSlot({ children }: Props) {
  return <div className="mt-4.5">{children}</div>;
});
