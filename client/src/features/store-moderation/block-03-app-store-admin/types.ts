/** Статус пункта чеклиста относительно текущего продукта. */
export type StoreReviewCheckStatus = "implemented" | "partial" | "manual";

export type StoreReviewChecklistRow = {
  key: string;
  title: string;
  /** Ссылка на гайдлайн (например 1.2, 1.5, 2.1). */
  appleRef: string;
  /** Что требует Apple (кратко). */
  appleExpectation: string;
  /** Как это закрыто в PING / что сделать вручную. */
  productNote: string;
  status: StoreReviewCheckStatus;
};
