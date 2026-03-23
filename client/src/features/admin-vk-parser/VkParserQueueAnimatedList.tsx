import { AnimatePresence, motion } from "framer-motion";
import type { AdminVkParserItem } from "@/lib/admin";
import { VK_PARSER_ITEM_STATUSES } from "@shared/schema";
import type { UseMutationResult } from "@tanstack/react-query";
import { DURATION_FAST_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { QUEUE_STATUS_LABELS } from "./constants";
import { VK_PARSER_QUEUE_ROW_CLASS, VkParserQueueItemContent } from "./VkParserQueueRow";

type StatusKey = (typeof VK_PARSER_ITEM_STATUSES)[number];

const listItemTransition = {
  duration: DURATION_FAST_S,
  ease: EASING_OUT_BEZIER,
} as const;

export function VkParserQueueAnimatedList(props: {
  queue: AdminVkParserItem[];
  bindingLabel: Map<string, string>;
  approveMut: UseMutationResult<{ platformPostId: string }, Error, string, unknown>;
  rejectMut: UseMutationResult<void, Error, string, unknown>;
  ariaLabelledBy: string;
}) {
  const reducedMotion = usePrefersReducedMotion();

  const contentProps = (item: AdminVkParserItem) => ({
    item,
    bindingLabel: props.bindingLabel.get(item.bindingId) ?? item.bindingId.slice(0, 8),
    statusLabel: QUEUE_STATUS_LABELS[item.status as StatusKey] ?? item.status,
    onApprove: () => props.approveMut.mutate(item.id),
    onReject: () => props.rejectMut.mutate(item.id),
    approvingThis: props.approveMut.isPending && props.approveMut.variables === item.id,
    rejectingThis: props.rejectMut.isPending && props.rejectMut.variables === item.id,
  });

  return (
    <ul className="space-y-4" aria-labelledby={props.ariaLabelledBy}>
      {reducedMotion
        ? props.queue.map((item) => (
            <li
              key={item.id}
              className={cn(VK_PARSER_QUEUE_ROW_CLASS, "transition-opacity duration-150")}
            >
              <VkParserQueueItemContent {...contentProps(item)} />
            </li>
          ))
        : null}
      {!reducedMotion ? (
        <AnimatePresence mode="popLayout" initial={false}>
          {props.queue.map((item, index) => {
            const enterDelay = Math.min(index, 6) * 0.028;
            return (
              <motion.li
                key={item.id}
                layout="position"
                className={VK_PARSER_QUEUE_ROW_CLASS}
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: { ...listItemTransition, delay: enterDelay },
                }}
                exit={{ opacity: 0, y: -8, transition: listItemTransition }}
              >
                <VkParserQueueItemContent {...contentProps(item)} />
              </motion.li>
            );
          })}
        </AnimatePresence>
      ) : null}
    </ul>
  );
}
