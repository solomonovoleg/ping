/** Уровень внимания модератора к регистрации (эвристика, не доказательство). */
export type SignupRiskLevel = "none" | "watch" | "alert";

export type SignupRiskSummary = {
  level: SignupRiskLevel;
  reasons: string[];
  sameDeviceOthers: number;
  sameIpUaOthers: number;
};

export function buildSignupRiskSummary(sameDeviceOthers: number, sameIpUaOthers: number): SignupRiskSummary {
  const reasons: string[] = [];
  let level: SignupRiskLevel = "none";

  if (sameDeviceOthers >= 2) {
    level = "alert";
    reasons.push(
      `С этого устройства (cookie) зарегистрировано не менее ${sameDeviceOthers + 1} аккаунтов, включая этого пользователя`,
    );
  } else if (sameDeviceOthers >= 1) {
    level = "watch";
    reasons.push("Есть ещё один активный аккаунт с того же устройства");
  }

  if (sameIpUaOthers >= 4) {
    if (level === "none") level = "watch";
    if (sameDeviceOthers < 2) {
      reasons.push(
        `Много регистраций с того же IP и отпечатка браузера (UA): не менее ${sameIpUaOthers + 1} аккаунтов`,
      );
    }
  }

  return { level, reasons, sameDeviceOthers, sameIpUaOthers };
}
