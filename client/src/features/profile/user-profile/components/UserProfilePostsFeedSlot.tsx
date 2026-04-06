import { memo, type ComponentProps } from "react";
import { UserProfilePostsContent } from "./UserProfilePostsContent";

type Props = ComponentProps<typeof UserProfilePostsContent>;

export const UserProfilePostsFeedSlot = memo(function UserProfilePostsFeedSlot(props: Props) {
  return <UserProfilePostsContent {...props} />;
});
