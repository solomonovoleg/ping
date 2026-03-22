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

const PROFILE_PATCH_WINDOW_MS = 15 * 60 * 1000;
const MAX_PROFILE_PATCH_PER_WINDOW = 45;

/** Анти-спам и усложнение перебора полей профиля (ставить после requireAuth). */
export const profilePatchLimiter = rateLimit({
  windowMs: PROFILE_PATCH_WINDOW_MS,
  max: MAX_PROFILE_PATCH_PER_WINDOW,
  message: { message: "Слишком частое сохранение профиля. Подождите немного." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const uid = getUserId(req);
    return uid ? `profile-patch:${uid}` : `profile-patch-ip:${req.ip ?? "unknown"}`;
  },
});

const LINK_PREVIEW_WINDOW_MS = 15 * 60 * 1000;
const MAX_LINK_PREVIEW_PER_WINDOW = 60;

/** Серверный fetch по URL — после requireAuth, защита от SSRF+нагрузки. */
export const linkPreviewLimiter = rateLimit({
  windowMs: LINK_PREVIEW_WINDOW_MS,
  max: MAX_LINK_PREVIEW_PER_WINDOW,
  message: { message: "Слишком много превью ссылок. Подождите немного." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const uid = getUserId(req);
    return uid ? `link-preview:${uid}` : `link-preview-ip:${req.ip ?? "unknown"}`;
  },
});

/**
 * Только маршрут GET /api/chats/dm-by-public-id/:id (открытие чата по public id, как /chat/15).
 * Переписка, догрузка истории и отправка идут через другие URL — сюда не попадают.
 * ~1 запрос на каждое открытие такого чата; 120/мин — запас для активного листания, всё ещё режет перебор сотнями.
 */
const DM_BY_PUBLIC_ID_WINDOW_MS = 60_000;
/** Листание списка + быстрые возвраты; только этот маршрут, не весь API. */
const MAX_DM_BY_PUBLIC_ID_PER_MINUTE = 300;

/** После requireAuth: ограничить перебор public id в URL (анти-скрейп). */
export const dmByPublicIdLimiter = rateLimit({
  windowMs: DM_BY_PUBLIC_ID_WINDOW_MS,
  max: MAX_DM_BY_PUBLIC_ID_PER_MINUTE,
  message: { message: "Слишком много открытий чатов по ссылке за минуту. Подождите немного." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const uid = getUserId(req);
    return uid ? `dm-by-pid:${uid}` : `dm-by-pid-ip:${req.ip ?? "unknown"}`;
  },
});

const REFERRALS_CHECK_WINDOW_MS = 15 * 60 * 1000;
const MAX_REFERRALS_CHECK_PER_WINDOW = 40;

/** Публичная проверка кода — только по IP, без перебора кодов. */
export const referralsCheckLimiter = rateLimit({
  windowMs: REFERRALS_CHECK_WINDOW_MS,
  max: MAX_REFERRALS_CHECK_PER_WINDOW,
  message: { message: "Слишком много проверок кода. Подождите немного." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `referrals-check:${req.ip ?? "unknown"}`,
});
