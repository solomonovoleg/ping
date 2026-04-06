export function buildUserProfilePageResult<
  Route extends Record<string, unknown>,
  View extends Record<string, unknown>,
  Layout extends Record<string, unknown>,
  Data extends Record<string, unknown>,
  Actions extends Record<string, unknown>,
>(args: {
  route: Route;
  view: View;
  layout: Layout;
  data: Data;
  actions: Actions;
}): Route & View & Layout & Data & Actions {
  return {
    ...args.route,
    ...args.view,
    ...args.layout,
    ...args.data,
    ...args.actions,
  };
}
