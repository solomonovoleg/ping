import { useCallback, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { createStory, uploadStoryMedia, type StoryExpiresHours } from "@/lib/stories";
import type { PostVideoTrimUpload } from "@/lib/posts";
import { validateStoryVideoFile } from "@/lib/story-media";
import { userProfileRu } from "../i18n.ru";

const t = userProfileRu;

type ToastFn = (args: { title: string; variant?: "default" | "destructive"; duration?: number }) => void;

export function useUserProfileStoryPublishFlow(args: {
  userId?: string;
  queryClient: QueryClient;
  toast: ToastFn;
  pendingStoryFile: File | null;
  pendingStoryVideoTrim: PostVideoTrimUpload | null;
  storyCaption: string;
  storyExpiresInHours: StoryExpiresHours;
  setAddingStory: Dispatch<SetStateAction<boolean>>;
  setStoryUploadPercent: Dispatch<SetStateAction<number | null>>;
  setPendingStoryFile: Dispatch<SetStateAction<File | null>>;
  setPendingStoryVideoTrim: Dispatch<SetStateAction<PostVideoTrimUpload | null>>;
  setShowStoryVideoTrimmer: Dispatch<SetStateAction<boolean>>;
  setShowStoryDurationPicker: Dispatch<SetStateAction<boolean>>;
  setStoryExpiresInHours: Dispatch<SetStateAction<StoryExpiresHours>>;
  setStoryCaption: Dispatch<SetStateAction<string>>;
}) {
  const storyTrimConfirmedRef = useRef(false);

  const handleStoryFileSelect = useCallback(
    (file: File | null) => {
      if (!file || !args.userId) return;
      args.setStoryExpiresInHours(24);
      args.setPendingStoryVideoTrim(null);
      const isVideo = file.type.startsWith("video/");
      if (isVideo) {
        const videoErr = validateStoryVideoFile(file);
        if (videoErr) {
          args.toast({ title: videoErr, variant: "destructive" });
          return;
        }
        args.setPendingStoryFile(file);
        args.setShowStoryVideoTrimmer(true);
        return;
      }
      args.setPendingStoryFile(file);
      args.setShowStoryDurationPicker(true);
    },
    [args],
  );

  const handleStoryVideoTrimConfirm = useCallback(
    (trim: PostVideoTrimUpload) => {
      storyTrimConfirmedRef.current = true;
      args.setPendingStoryVideoTrim(trim);
      args.setShowStoryVideoTrimmer(false);
      args.setShowStoryDurationPicker(true);
    },
    [args],
  );

  const handleStoryTrimmerOpenChange = useCallback(
    (open: boolean) => {
      args.setShowStoryVideoTrimmer(open);
      if (!open) {
        if (storyTrimConfirmedRef.current) {
          storyTrimConfirmedRef.current = false;
          return;
        }
        args.setPendingStoryFile(null);
        args.setPendingStoryVideoTrim(null);
      }
    },
    [args],
  );

  const cancelStoryPublishFlow = useCallback(() => {
    args.setShowStoryDurationPicker(false);
    args.setPendingStoryFile(null);
    args.setPendingStoryVideoTrim(null);
    args.setStoryCaption("");
  }, [args]);

  const handlePublishStory = useCallback(async () => {
    const file = args.pendingStoryFile;
    if (!file || !args.userId) return;
    args.setShowStoryDurationPicker(false);
    args.setAddingStory(true);
    args.setStoryUploadPercent(0);
    try {
      const trim = file.type.startsWith("video/") ? args.pendingStoryVideoTrim ?? undefined : undefined;
      const url = await uploadStoryMedia(file, trim, {
        onProgress: (p) => args.setStoryUploadPercent(p),
      });
      const cap = args.storyCaption.trim();
      await createStory(url, { expiresInHours: args.storyExpiresInHours, caption: cap || undefined });
      args.setStoryCaption("");
      void args.queryClient.invalidateQueries({ queryKey: ["stories", args.userId] });
      void args.queryClient.invalidateQueries({ queryKey: ["stories", "feed"] });
      args.toast({ title: t.toast.storyAddedHours(args.storyExpiresInHours) });
    } catch (err) {
      args.toast({ title: err instanceof Error ? err.message : t.toast.publishError, variant: "destructive" });
    } finally {
      args.setPendingStoryFile(null);
      args.setPendingStoryVideoTrim(null);
      args.setStoryUploadPercent(null);
      args.setAddingStory(false);
    }
  }, [args]);

  return {
    handleStoryFileSelect,
    handleStoryVideoTrimConfirm,
    handleStoryTrimmerOpenChange,
    cancelStoryPublishFlow,
    handlePublishStory,
  };
}
