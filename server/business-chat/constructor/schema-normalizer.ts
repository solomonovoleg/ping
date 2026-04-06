import type { ConstructorAction, NormalizedBusinessDsl } from "../types";

function safeMethod(raw: unknown): ConstructorAction["method"] {
  const up = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (up === "GET" || up === "POST" || up === "PUT" || up === "PATCH" || up === "DELETE") return up;
  return "POST";
}

function normalizeFromBusinessContract(contract: Record<string, unknown>): ConstructorAction[] {
  const actionsRaw = Array.isArray(contract.actions) ? contract.actions : [];
  const out: ConstructorAction[] = [];
  for (let index = 0; index < actionsRaw.length; index += 1) {
    const item = actionsRaw[index];
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : `action_${index + 1}`;
    const label = typeof row.label === "string" && row.label.trim() ? row.label.trim() : id;
    const kindRaw = typeof row.kind === "string" ? row.kind : "button";
    const kind = kindRaw === "form" || kindRaw === "file_upload" ? kindRaw : "button";
    const method = safeMethod(row.method);
    const path = typeof row.path === "string" && row.path.trim() ? row.path.trim() : "/";
    out.push({
      id,
      label,
      kind,
      method,
      path,
      inputSchema: (row.inputSchema as Record<string, unknown> | null | undefined) ?? null,
      payload: (row.payload as Record<string, unknown> | null | undefined) ?? null,
      orderIndex: index,
    });
  }
  return out;
}

function normalizeFromOpenApi(contract: Record<string, unknown>): ConstructorAction[] {
  const paths = contract.paths;
  if (!paths || typeof paths !== "object") return [];
  const out: ConstructorAction[] = [];
  const pathsObj = paths as Record<string, unknown>;
  for (const [path, rawOps] of Object.entries(pathsObj)) {
    if (!rawOps || typeof rawOps !== "object") continue;
    const ops = rawOps as Record<string, unknown>;
    for (const [methodRaw, opRaw] of Object.entries(ops)) {
      if (!opRaw || typeof opRaw !== "object") continue;
      const method = safeMethod(methodRaw);
      if (method === "GET" && !String(path).startsWith("/commands")) continue;
      const op = opRaw as Record<string, unknown>;
      const opId = typeof op.operationId === "string" ? op.operationId.trim() : "";
      const summary = typeof op.summary === "string" ? op.summary.trim() : "";
      const id = opId || `${method.toLowerCase()}_${String(path).replace(/[^\w]+/g, "_")}`.replace(/^_+|_+$/g, "");
      const label = summary || id;
      out.push({
        id,
        label,
        kind: method === "GET" ? "button" : "form",
        method,
        path,
        inputSchema: null,
        payload: null,
        orderIndex: out.length,
      });
    }
  }
  return out;
}

export function normalizeBusinessContract(contract: unknown): NormalizedBusinessDsl {
  if (!contract || typeof contract !== "object") {
    return { source: "business_contract", actions: [] };
  }
  const objectContract = contract as Record<string, unknown>;
  const hasOpenApi = typeof objectContract.openapi === "string" || typeof objectContract.swagger === "string";
  if (hasOpenApi) {
    return {
      source: "openapi",
      actions: normalizeFromOpenApi(objectContract),
    };
  }
  return {
    source: "business_contract",
    actions: normalizeFromBusinessContract(objectContract),
  };
}
