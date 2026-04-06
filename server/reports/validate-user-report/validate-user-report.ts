import { ReportsTargetValidationError } from "../reports-target-validation-error";
import { storage } from "../../storage";

export async function validateUserReport(reporterUserId: string, targetId: string): Promise<void> {
  if (targetId === reporterUserId) {
    throw new ReportsTargetValidationError(400, "Нельзя отправить жалобу на себя");
  }
  const user = await storage.getUser(targetId);
  if (!user || user.deletedAt) {
    throw new ReportsTargetValidationError(404, "Пользователь не найден");
  }
}
