export type AdvancedRiskStatus = "na" | "check" | "risk";

export type AdvancedRiskRow = {
  key: string;
  title: string;
  guideline: string;
  risk: string;
  productNote: string;
  status: AdvancedRiskStatus;
};
