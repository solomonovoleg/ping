export type PrivacyComplianceStatus = "implemented" | "partial" | "manual";

export type PrivacyComplianceRow = {
  key: string;
  title: string;
  appleTopic: string;
  expectation: string;
  productNote: string;
  status: PrivacyComplianceStatus;
};
