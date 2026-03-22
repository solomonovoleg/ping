/** Подсказки городов через Photon (OSM). Без API-ключа; не для массового геокодирования. */

const PHOTON_URL = "https://photon.komoot.io/api/";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const TIMEOUT_MS = 8000;
const MAX_RESULTS = 10;
const FALLBACK_CITIES = [
  "Москва, Россия",
  "Санкт-Петербург, Россия",
  "Новосибирск, Россия",
  "Екатеринбург, Россия",
  "Казань, Россия",
  "Нижний Новгород, Россия",
  "Челябинск, Россия",
  "Самара, Россия",
  "Омск, Россия",
  "Ростов-на-Дону, Россия",
  "Уфа, Россия",
  "Красноярск, Россия",
  "Воронеж, Россия",
  "Пермь, Россия",
  "Волгоград, Россия",
  "Краснодар, Россия",
  "Сочи, Россия",
  "Тюмень, Россия",
  "Иркутск, Россия",
  "Владивосток, Россия",
  "Хабаровск, Россия",
  "Томск, Россия",
  "Барнаул, Россия",
  "Кемерово, Россия",
  "Саратов, Россия",
  "Тула, Россия",
  "Ярославль, Россия",
  "Калининград, Россия",
  "Минск, Беларусь",
  "Гомель, Беларусь",
  "Брест, Беларусь",
  "Алматы, Казахстан",
  "Астана, Казахстан",
  "Шымкент, Казахстан",
  "Караганда, Казахстан",
  "Бишкек, Кыргызстан",
  "Ош, Кыргызстан",
  "Ташкент, Узбекистан",
  "Самарканд, Узбекистан",
  "Баку, Азербайджан",
  "Ереван, Армения",
  "Тбилиси, Грузия",
  "Кишинёв, Молдова",
  "Киев, Украина",
  "Одесса, Украина",
  "Харьков, Украина",
  "Днепр, Украина",
  "Львов, Украина",
];

const EXCLUDE_TYPES = new Set([
  "house",
  "street",
  "road",
  "path",
  "footway",
  "suburb",
  "neighbourhood",
  "quarter",
  "postcode",
  "state",
  "country",
  "county",
  "region",
]);

type PhotonProps = {
  name?: string;
  type?: string;
  country?: string;
  state?: string;
  county?: string;
  osm_key?: string;
  osm_value?: string;
};

type PhotonFeature = { properties?: PhotonProps };

type NominatimItem = {
  name?: string;
  display_name?: string;
  type?: string;
  category?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
  };
};

function buildLabel(p: PhotonProps): string | null {
  const name = typeof p.name === "string" ? p.name.trim() : "";
  if (!name) return null;
  const state = typeof p.state === "string" ? p.state.trim() : "";
  const country = typeof p.country === "string" ? p.country.trim() : "";
  const parts: string[] = [name];
  if (state && state !== name) parts.push(state);
  if (country && country !== name && country !== state) parts.push(country);
  return parts.join(", ");
}

function dedupeAndLimit(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const label = item.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= MAX_RESULTS) break;
  }
  return out;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "PING-MOOT/1.0 (+https://github.com) city-suggest",
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPhotonSuggestions(q: string): Promise<string[]> {
  const data = await fetchJson<{ features?: PhotonFeature[] }>(
    `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=24&lang=ru`
  );
  const features = Array.isArray(data?.features) ? data.features : [];
  const out: string[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const t = String(p.type ?? "").toLowerCase();
    if (t && EXCLUDE_TYPES.has(t)) continue;
    if (p.osm_key === "highway" || p.osm_key === "railway") continue;

    const label = buildLabel(p);
    if (!label) continue;
    out.push(label);
  }
  return dedupeAndLimit(out);
}

function buildNominatimLabel(item: NominatimItem): string | null {
  const address = item.address ?? {};
  const city =
    typeof address.city === "string" && address.city.trim()
      ? address.city.trim()
      : typeof address.town === "string" && address.town.trim()
        ? address.town.trim()
        : typeof address.village === "string" && address.village.trim()
          ? address.village.trim()
          : typeof address.municipality === "string" && address.municipality.trim()
            ? address.municipality.trim()
            : typeof item.name === "string" && item.name.trim()
              ? item.name.trim()
              : "";
  if (!city) return null;
  const state = typeof address.state === "string" ? address.state.trim() : "";
  const country = typeof address.country === "string" ? address.country.trim() : "";
  const parts = [city];
  if (state && state !== city) parts.push(state);
  if (country && country !== city && country !== state) parts.push(country);
  return parts.join(", ");
}

async function fetchNominatimSuggestions(q: string): Promise<string[]> {
  const data = await fetchJson<NominatimItem[]>(
    `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=jsonv2&limit=12&addressdetails=1&accept-language=ru`
  );
  const list = Array.isArray(data) ? data : [];
  const out: string[] = [];
  for (const item of list) {
    const type = String(item.type ?? "").toLowerCase();
    const category = String(item.category ?? "").toLowerCase();
    const isPlace =
      category === "place" ||
      type === "city" ||
      type === "town" ||
      type === "village" ||
      type === "municipality";
    if (!isPlace) continue;
    const label = buildNominatimLabel(item);
    if (!label) continue;
    out.push(label);
  }
  return dedupeAndLimit(out);
}

function fallbackCitySuggestions(q: string): string[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  return FALLBACK_CITIES.filter((city) => city.toLowerCase().includes(needle)).slice(0, MAX_RESULTS);
}

export async function fetchCitySuggestions(rawQuery: string): Promise<string[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];
  const [photon, nominatim] = await Promise.all([
    fetchPhotonSuggestions(q),
    fetchNominatimSuggestions(q),
  ]);
  const merged = dedupeAndLimit([...photon, ...nominatim]);
  if (merged.length > 0) return merged;
  return fallbackCitySuggestions(q);
}
