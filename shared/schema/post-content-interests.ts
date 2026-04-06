/**
 * Скрытая серверная разметка поста для будущего ранжирования и профиля интересов.
 * Не отдаётся в публичные JSON-ответы API — только БД (`posts.content_interests`).
 *
 * v2: по каждой из 10 осей — широкие теги (тема) + узкие (подтемы/сущности, только если явно в тексте).
 * Плюс geoMentions — города/регионы для гео-весов в алгоритме.
 */
export const POST_CONTENT_INTEREST_VERSION = 2 as const;

export const POST_CONTENT_INTEREST_CATEGORIES = [
  {
    slug: "themes",
    labelRu: "Предметные темы",
    hintRu: "о чём контент: ниши, сферы, явления (не хештеги). broad=широко, specific=марки, жанры, узкие ниши если явно сказано",
  },
  {
    slug: "activities_events",
    labelRu: "Активности и события",
    hintRu: "что происходит: тренировка, концерт, ремонт, ЧП, происшествие",
  },
  {
    slug: "places_travel",
    labelRu: "Места и путешествия",
    hintRu: "локации в духе поста (не дублируй geoMentions целиком — там город для алгоритма)",
  },
  {
    slug: "food_home_lifestyle",
    labelRu: "Еда, дом и быт",
    hintRu: "кухня, рестораны, уют, питомцы, быт",
  },
  {
    slug: "wellness_body",
    labelRu: "Здоровье и тело",
    hintRu: "спорт, сон, врачи, психология",
  },
  {
    slug: "work_study_skills",
    labelRu: "Работа, учёба, навыки",
    hintRu: "карьера, обучение, курсы, инструменты",
  },
  {
    slug: "culture_media",
    labelRu: "Культура и медиа",
    hintRu: "кино, музыка, игры, книги, стримы",
  },
  {
    slug: "tech_digital",
    labelRu: "Технологии и digital",
    hintRu: "гаджеты, приложения, IT",
  },
  {
    slug: "people_society",
    labelRu: "Люди и общество",
    hintRu: "отношения, семья, общество, новости/ЧП как социальный контекст",
  },
  {
    slug: "tone_intent",
    labelRu: "Тон, формат и намерение",
    hintRu: "новость, мнение, юмор, реклама, драматично, вопрос; для негатива: «негативные новости», «происшествие»",
  },
] as const;

export type PostContentInterestCategorySlug = (typeof POST_CONTENT_INTEREST_CATEGORIES)[number]["slug"];

export const POST_CONTENT_INTEREST_SLUGS: PostContentInterestCategorySlug[] = POST_CONTENT_INTEREST_CATEGORIES.map(
  (c) => c.slug,
);

/** Широкие теги по оси (агрегация интересов) */
export const POST_INTEREST_BROAD_MIN = 1;
export const POST_INTEREST_BROAD_MAX = 4;
/** Узкие теги — только если обоснованы текстом; допустимо 0 */
export const POST_INTEREST_SPECIFIC_MAX = 6;
/** Упомянутые города/страны/регионы для гео-скоринга (нормализованные названия) */
export const POST_INTEREST_GEO_MAX = 8;

/** Кластер «тема + подтемы» внутри одной оси */
export type PostInterestCluster = {
  broad: string[];
  specific: string[];
};

export type PostContentInterestsPayload = {
  v: typeof POST_CONTENT_INTEREST_VERSION;
  model?: string;
  /** Города/регионы/страны из текста — отдельно от осей, под гео-веса в ранжировании */
  geoMentions?: string[];
  categories: Record<PostContentInterestCategorySlug, PostInterestCluster>;
};
