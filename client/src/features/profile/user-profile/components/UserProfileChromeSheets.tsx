import { memo } from "react";
import { UserBlockAlertDialog, UserUnblockAlertDialog } from "@/features/user-blocking";
import { ProfileAnalyticsSheet } from "./ProfileAnalyticsSheet";
import { UserProfileMoreSheet } from "./UserProfileMoreSheet";

type Props = {
  profileAnalyticsOpen: boolean;
  onProfileAnalyticsClose: () => void;
  profileMoreOpen: boolean;
  onProfileMoreClose: () => void;
  isMe: boolean;
  onCopyLink: () => void;
  onOpenSettings: () => void;
  isBlockedByMe: boolean;
  onRequestUnblock: (() => void) | undefined;
  onRequestBlock: (() => void) | undefined;
  onRequestReport: (() => void) | undefined;
  profileBlockOpen: boolean;
  onProfileBlockOpenChange: (open: boolean) => void;
  blockTargetUserId: string | null;
  displayName: string;
  onBlocked: () => void;
  profileUnblockOpen: boolean;
  onProfileUnblockOpenChange: (open: boolean) => void;
  unblockTargetUserId: string | null;
  onUnblocked: () => void;
};

export const UserProfileChromeSheets = memo(function UserProfileChromeSheets({
  profileAnalyticsOpen,
  onProfileAnalyticsClose,
  profileMoreOpen,
  onProfileMoreClose,
  isMe,
  onCopyLink,
  onOpenSettings,
  isBlockedByMe,
  onRequestUnblock,
  onRequestBlock,
  onRequestReport,
  profileBlockOpen,
  onProfileBlockOpenChange,
  blockTargetUserId,
  displayName,
  onBlocked,
  profileUnblockOpen,
  onProfileUnblockOpenChange,
  unblockTargetUserId,
  onUnblocked,
}: Props) {
  return (
    <>
      <ProfileAnalyticsSheet open={profileAnalyticsOpen} onClose={onProfileAnalyticsClose} />

      <UserProfileMoreSheet
        open={profileMoreOpen}
        onClose={onProfileMoreClose}
        isMe={isMe}
        onCopyLink={onCopyLink}
        onOpenSettings={onOpenSettings}
        isBlockedByMe={isBlockedByMe}
        onUnblockUser={onRequestUnblock}
        onBlockUser={onRequestBlock}
        onReportUser={onRequestReport}
      />

      <UserBlockAlertDialog
        open={profileBlockOpen}
        onOpenChange={onProfileBlockOpenChange}
        targetUserId={blockTargetUserId}
        targetDisplayName={displayName}
        initialPreset="full"
        onBlocked={onBlocked}
      />

      <UserUnblockAlertDialog
        open={profileUnblockOpen}
        onOpenChange={onProfileUnblockOpenChange}
        targetUserId={unblockTargetUserId}
        targetDisplayName={displayName}
        onUnblocked={onUnblocked}
      />
    </>
  );
});
