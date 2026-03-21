import rateLimit from "express-rate-limit";
import { getUserId } from "./session";

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

const CONTACTS_MATCH_WINDOW_MS = 15 * 60 * 1000;
const MAX_CONTACTS_MATCH_PER_WINDOW = 25;

/** Сопоставление телефонной книги с аккаунтами Ping (анти-спам перебора). */
export const contactsPhoneMatchLimiter = rateLimit({
  windowMs: CONTACTS_MATCH_WINDOW_MS,
  max: MAX_CONTACTS_MATCH_PER_WINDOW,
  message: { message: "Слишком частая проверка контактов. Подождите немного." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const uid = getUserId(req);
    return uid ? `contacts-match:${uid}` : `contacts-match-ip:${req.ip ?? "unknown"}`;
  },
});
