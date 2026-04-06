export type MetadataComplianceStatus = "ok" | "risk" | "manual";

export type MetadataComplianceRow = {
  key: string;
  title: string;
  source: string;
  expectation: string;
  productNote: string;
  status: MetadataComplianceStatus;
};
