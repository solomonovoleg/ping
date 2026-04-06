/** Доменная ошибка HTTP для API стикер-паков (4xx/5xx с телом `{ message }`). */
export class StickerPackError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "StickerPackError";
    this.status = status;
  }
}
