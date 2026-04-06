import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { block01ugcRu } from "./i18n.ru";
import { submitContentReport, type SubmitContentReportInput } from "./submit-content-report";

export function useContentReportSubmit(onSuccessClose?: () => void) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: (input: SubmitContentReportInput) => submitContentReport(input),
    onSuccess: (data) => {
      const title =
        data.message?.trim() ||
        (data.duplicate ? block01ugcRu.successDuplicateAck : block01ugcRu.successDefault);
      const description = data.duplicate
        ? block01ugcRu.successDuplicateToastDescription
        : block01ugcRu.successThankYou;
      toast({ title, description });
      onSuccessClose?.();
    },
    onError: (e) => {
      try {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[ping:report] mutation onError", e instanceof Error ? e.message : e);
        }
      } catch {
        /* ignore */
      }
      toast({
        title: e instanceof Error && e.message.trim() ? e.message.trim() : block01ugcRu.errorDefault,
        variant: "destructive",
      });
    },
  });
}
