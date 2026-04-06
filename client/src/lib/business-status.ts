import { API, apiFetch, toApiRequestError } from "@/lib/api-base";

export type BusinessStatus = "none" | "pending" | "approved" | "rejected" | "revision_required";

export type BusinessStatusRequestDecision = "approved" | "rejected" | "revision_required";

export type BusinessStatusRequest = {
  id: string;
  userId: string;
  reason: string;
  links: string[];
  consentModeration: boolean;
  status: "submitted" | "approved" | "rejected" | "revision_required";
  adminComment: string | null;
  moderatedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  moderatedAt: string | null;
};

export type MyBusinessStatusRequestState = {
  businessStatus: BusinessStatus;
  activeRequest: BusinessStatusRequest | null;
  latestRequest: BusinessStatusRequest | null;
};

export async function fetchMyBusinessStatusRequestState(): Promise<MyBusinessStatusRequestState> {
  const res = await apiFetch(`${API}/users/me/business-status-request`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw await toApiRequestError(res);
  return res.json();
}

export async function submitMyBusinessStatusRequest(payload: {
  reason: string;
  links: string[];
  consentModeration: boolean;
}): Promise<{ businessStatus: "pending"; request: BusinessStatusRequest }> {
  const res = await apiFetch(`${API}/users/me/business-status-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await toApiRequestError(res);
  return res.json();
}
