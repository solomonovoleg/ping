import type { NormalizedBusinessDsl, UiBlueprint } from "../types";

export function buildUiBlueprintFromDsl(dsl: NormalizedBusinessDsl): UiBlueprint {
  const actions = dsl.actions
    .slice()
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .map((action) => ({
      id: action.id,
      label: action.label,
      kind: action.kind,
      confirmMode: action.kind === "file_upload" ? ("confirm" as const) : ("none" as const),
      inputSchema: action.inputSchema ?? null,
    }));
  return {
    version: 1,
    actions,
  };
}
