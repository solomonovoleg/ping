import rateLimit from "express-rate-limit";

const WINDOW_MS = 15 * 60 * 1000; // 15 минут
const MAX_LOGIN = 10;
const MAX_REGISTER = 5;

export const loginLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_LOGIN,
  message: { message: "Слишком много попыток входа. Попробуйте позже." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REGISTER,
  message: { message: "Слишком много регистраций. Попробуйте позже." },
  standardHeaders: true,
  legacyHeaders: false,
});
