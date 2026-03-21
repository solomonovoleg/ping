/** Подсказки городов через Photon (OSM). Без API-ключа; не для массового геокодирования. */

const PHOTON_URL = "https://photon.komoot.io/api/";
const TIMEOUT_MS = 8000;
const MAX_RESULTS = 10;

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

export async function fetchCitySuggestions(rawQuery: string): Promise<string[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const url = `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=24&lang=ru`;
    const res = await fetch(url, {
      signal: ac.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "PING-MOOT/1.0 (+https://github.com) city-suggest",
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const features = Array.isArray(data.features) ? data.features : [];
    const seen = new Set<string>();
    const out: string[] = [];

    for (const f of features) {
      const p = f.properties ?? {};
      const t = String(p.type ?? "").toLowerCase();
      if (t && EXCLUDE_TYPES.has(t)) continue;
      if (p.osm_key === "highway" || p.osm_key === "railway") continue;

      const label = buildLabel(p);
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(label);
      if (out.length >= MAX_RESULTS) break;
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
