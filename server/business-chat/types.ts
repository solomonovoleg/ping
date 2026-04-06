export type ConstructorActionKind = "button" | "form" | "file_upload";

export type ConstructorAction = {
  id: string;
  label: string;
  kind: ConstructorActionKind;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  inputSchema?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  orderIndex?: number;
};

export type NormalizedBusinessDsl = {
  source: "openapi" | "business_contract";
  actions: ConstructorAction[];
};

export type UiActionBlueprint = {
  id: string;
  label: string;
  kind: ConstructorActionKind;
  confirmMode: "none" | "confirm";
  inputSchema?: Record<string, unknown> | null;
};

export type UiBlueprint = {
  version: number;
  actions: UiActionBlueprint[];
};

export type AutoConnectInput = {
  name: string;
  endpointUrl: string;
  apiKey: string;
  providerType?: string;
  contractUrl?: string | null;
};

export type InboundWebhookPayload =
  | {
      type: "message_text";
      eventId?: string;
      text: string;
    }
  | {
      type: "message_file";
      eventId?: string;
      fileUrl: string;
      fileName?: string | null;
      mimeType?: string | null;
    }
  | {
      type: "command_set";
      eventId?: string;
      commands: Array<{
        id: string;
        label: string;
        kind?: ConstructorActionKind;
        method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        path?: string;
        inputSchema?: Record<string, unknown> | null;
        payload?: Record<string, unknown> | null;
      }>;
    };
