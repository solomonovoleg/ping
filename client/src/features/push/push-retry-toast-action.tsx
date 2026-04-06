import { ToastAction } from "@/components/ui/toast";

export function pushRetryToastAction(onRetry: () => void) {
  return (
    <ToastAction altText="Повторить" onClick={onRetry}>
      Повторить
    </ToastAction>
  );
}
