import {
  FILMWEB_POPULAR_SCHEMA_VERSION,
  filmwebPosterUrl,
  isPopularFilmsCache,
  isPopularFilmsCacheStale,
  type FilmwebFilm,
  type PopularFilmsCache,
} from "../lib/filmweb.ts";
import { allSettledConcurrent } from "./concurrency.ts";
import { fetchWithTimeout } from "./fetch.ts";

const FILMWEB_API_BASE = "https://www.filmweb.pl/api/v1";
const FILMWEB_DETAIL_CONCURRENCY = 4;
const FILMWEB_POPULAR_LIMIT = 40;

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function popularCacheKey(): string {
  return `FILMWEB_POPULAR:${FILMWEB_POPULAR_SCHEMA_VERSION}`;
}

function logFilmwebFailure(id: number, error: unknown): void {
  console.warn(JSON.stringify({
    message: "filmweb film info failed",
    filmId: id,
    errorType: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
  }));
}

async function fetchFilmwebJson(url: string, fetcher: Fetcher): Promise<unknown> {
  const response = await fetcher(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Filmweb request failed with status ${response.status}`);
  return await response.json();
}

export async function fetchPopularFilmIds(fetcher: Fetcher = fetchWithTimeout): Promise<number[]> {
  const data = await fetchFilmwebJson(`${FILMWEB_API_BASE}/film/popular/in-cinema`, fetcher);
  if (!Array.isArray(data)) throw new Error("Invalid Filmweb popular response");
  return data
    .filter((id): id is number => Number.isInteger(id) && Number(id) > 0)
    .slice(0, FILMWEB_POPULAR_LIMIT);
}

export async function fetchFilmInfo(
  id: number,
  fetcher: Fetcher = fetchWithTimeout,
): Promise<FilmwebFilm | null> {
  const data = await fetchFilmwebJson(`${FILMWEB_API_BASE}/title/${id}/info`, fetcher);
  if (!isObject(data)) return null;

  const title = stringValue(data.title);
  if (!title) return null;

  return {
    id,
    title,
    originalTitle: stringValue(data.originalTitle) || title,
    year: Number.isInteger(data.year) ? Number(data.year) : null,
    subType: stringValue(data.subType),
    posterUrl: filmwebPosterUrl(data.posterPath),
  };
}

export async function fetchPopularFilms(fetcher: Fetcher = fetchWithTimeout): Promise<FilmwebFilm[]> {
  const ids = await fetchPopularFilmIds(fetcher);
  const results = await allSettledConcurrent(
    ids,
    FILMWEB_DETAIL_CONCURRENCY,
    (id) => fetchFilmInfo(id, fetcher),
  );

  return results.flatMap((result, index) => {
    if (result.status === "rejected") {
      logFilmwebFailure(ids[index], result.reason);
      return [];
    }
    return result.value ? [result.value] : [];
  });
}

export async function getCachedPopularFilms(kv: KVNamespace): Promise<PopularFilmsCache | null> {
  const value: unknown = await kv.get(popularCacheKey(), "json");
  return isPopularFilmsCache(value) ? value : null;
}

export async function setCachedPopularFilms(
  kv: KVNamespace,
  cache: PopularFilmsCache,
): Promise<void> {
  await kv.put(popularCacheKey(), JSON.stringify(cache));
}

export async function refreshPopularFilms(kv: KVNamespace): Promise<PopularFilmsCache> {
  const cache: PopularFilmsCache = {
    schemaVersion: FILMWEB_POPULAR_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    films: await fetchPopularFilms(),
  };
  await setCachedPopularFilms(kv, cache);
  return cache;
}

export async function refreshPopularFilmsIfStale(
  kv: KVNamespace,
): Promise<PopularFilmsCache | null> {
  const cached = await getCachedPopularFilms(kv);
  if (cached && !isPopularFilmsCacheStale(cached)) return null;
  return refreshPopularFilms(kv);
}

export async function getAvailablePopularFilms(kv: KVNamespace): Promise<FilmwebFilm[]> {
  const cached = await getCachedPopularFilms(kv);
  return cached ? cached.films : [];
}
