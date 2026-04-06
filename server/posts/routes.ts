import type { Express } from "express";
import { registerPostsViewEngageRoutes } from "./posts-routes-activity";
import { registerPostsCreateRoutes } from "./posts-routes-create";
import { registerPostsFeedRoutes, registerPostsSavedListRoute } from "./posts-routes-read";
import { registerPostsMutateRoutes } from "./posts-routes-mutate";
import { registerPostsShareSaveRoutes } from "./posts-routes-share-save";

/**
 * HTTP постов. Порядок регистрации совпадает с прежним монолитным `routes.ts`
 * (view/engage → delete/patch → share/save → список сохранённых).
 */
export function registerPostsRoutes(app: Express): void {
  registerPostsCreateRoutes(app);
  registerPostsFeedRoutes(app);
  registerPostsViewEngageRoutes(app);
  registerPostsMutateRoutes(app);
  registerPostsShareSaveRoutes(app);
  registerPostsSavedListRoute(app);
}
