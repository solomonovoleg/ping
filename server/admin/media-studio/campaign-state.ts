/**
 * Состояния кампаний медиа-студии и очереди постов (см. docs/ADMIN_MEDIA_STUDIO_SPEC.md).
 */

export const MEDIA_STUDIO_CAMPAIGN_STATUSES = ["draft", "running", "paused", "completed", "cancelled"] as const;
export type MediaStudioCampaignStatus = (typeof MEDIA_STUDIO_CAMPAIGN_STATUSES)[number];

export const MEDIA_STUDIO_POST_QUEUE_STATES = ["queued", "published", "failed", "skipped"] as const;
export type MediaStudioCampaignPostState = (typeof MEDIA_STUDIO_POST_QUEUE_STATES)[number];

export const MEDIA_STUDIO_SCHEDULE_MODES = ["fixed_interval", "random_interval"] as const;
export type MediaStudioScheduleMode = (typeof MEDIA_STUDIO_SCHEDULE_MODES)[number];

/** Допустимые переходы статуса кампании (воркер и PATCH API). */
export function canTransitionCampaignStatus(
  from: MediaStudioCampaignStatus,
  to: MediaStudioCampaignStatus,
): boolean {
  const edges: Record<MediaStudioCampaignStatus, MediaStudioCampaignStatus[]> = {
    draft: ["running", "cancelled"],
    running: ["paused", "completed", "cancelled"],
    paused: ["running", "cancelled"],
    completed: [],
    cancelled: [],
  };
  return edges[from]?.includes(to) ?? false;
}
