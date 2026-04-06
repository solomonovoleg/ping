import { assembleListPostsForViewer } from "./list-posts-for-viewer-assemble";
import { loadListPostsFeedRows } from "./list-posts-for-viewer-load";
import type { ListPostsForViewerParams } from "./list-posts-for-viewer-types";

export type { ListPostsFeedRow, ListPostsForViewerParams } from "./list-posts-for-viewer-types";

export async function listPostsForViewer(params: ListPostsForViewerParams) {
  const rows = await loadListPostsFeedRows(params);
  return assembleListPostsForViewer(rows, params.viewerId);
}
