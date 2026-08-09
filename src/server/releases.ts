import type { Locale } from "../i18n/translations.ts";
import {
  RELEASE_CATALOG_SCHEMA_VERSION,
  isReleaseCatalog,
  isReleaseCatalogStale,
  type ReleaseCatalog,
  type ReleaseGenre,
  type UpcomingRelease,
} from "../lib/releases.ts";
import { isDateKey } from "../lib/warsaw-date.ts";
import { fetchWithTimeout } from "./fetch.ts";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const TMDB_MAX_PAGES = 500;
const TMDB_PAGE_CONCURRENCY = 4;

const TMDB_LANGUAGES: Record<Locale, string> = {
  pl: "pl-PL",
  en: "en-US",
};

type JsonObject = Record<string, unknown>;

type TmdbPage = {
  page: number;
  totalPages: number;
  results: JsonObject[];
};

export class ReleaseCatalogUnavailableError extends Error {
  constructor(message = "Upcoming releases are unavailable") {
    super(message);
    this.name = "ReleaseCatalogUnavailableError";
  }
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function integer(value: unknown): number | null {
  return Number.isInteger(value) ? Number(value) : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function releaseCacheKey(locale: Locale): string {
  return `RELEASES:${RELEASE_CATALOG_SCHEMA_VERSION}:${locale}`;
}

function retryDelay(response: Response): number {
  const seconds = Number(response.headers.get("Retry-After"));
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1_000, 1_000)
    : 250;
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchTmdbJson(url: URL, token: string): Promise<unknown> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) return await response.json();

      const retryable = response.status === 429 || response.status >= 500;
      lastError = new Error(`TMDB request failed with status ${response.status}`);
      if (!retryable || attempt === 1) break;
      await wait(retryDelay(response));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === 1) break;
      await wait(250);
    }
  }

  throw lastError ?? new Error("TMDB request failed");
}

async function fetchGenres(token: string, locale: Locale): Promise<ReleaseGenre[]> {
  const url = new URL(`${TMDB_API_BASE}/genre/movie/list`);
  url.searchParams.set("language", TMDB_LANGUAGES[locale]);
  const data = await fetchTmdbJson(url, token);
  if (!isObject(data) || !Array.isArray(data.genres)) throw new Error("Invalid TMDB genre response");

  return data.genres.flatMap((value) => {
    if (!isObject(value)) return [];
    const id = integer(value.id);
    const name = stringValue(value.name);
    return id !== null && id > 0 && name ? [{ id, name }] : [];
  }).sort((left, right) => left.name.localeCompare(right.name, locale));
}

async function fetchDiscoverPage(
  token: string,
  locale: Locale,
  today: string,
  page: number,
): Promise<TmdbPage> {
  const url = new URL(`${TMDB_API_BASE}/discover/movie`);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("include_video", "false");
  url.searchParams.set("language", TMDB_LANGUAGES[locale]);
  url.searchParams.set("page", String(page));
  url.searchParams.set("region", "PL");
  url.searchParams.set("release_date.gte", today);
  url.searchParams.set("sort_by", "primary_release_date.asc");
  url.searchParams.set("with_release_type", "2|3");

  const data = await fetchTmdbJson(url, token);
  if (!isObject(data) || !Array.isArray(data.results)) throw new Error("Invalid TMDB discover response");

  const responsePage = integer(data.page);
  const reportedPages = integer(data.total_pages);
  if (responsePage === null || reportedPages === null || reportedPages < 0) {
    throw new Error("Invalid TMDB pagination response");
  }

  return {
    page: responsePage,
    totalPages: Math.min(reportedPages, TMDB_MAX_PAGES),
    results: data.results.filter(isObject),
  };
}

function mapRelease(
  value: JsonObject,
  genreById: Map<number, ReleaseGenre>,
  locale: Locale,
  today: string,
): UpcomingRelease | null {
  const id = integer(value.id);
  const releaseDate = stringValue(value.release_date);
  const localizedTitle = stringValue(value.title);
  const originalTitle = stringValue(value.original_title) || localizedTitle;

  if (id === null || id <= 0 || !localizedTitle || !isDateKey(releaseDate) || releaseDate < today) {
    return null;
  }

  const genreIds = Array.isArray(value.genre_ids)
    ? value.genre_ids.map(integer).filter((genreId): genreId is number => genreId !== null)
    : [];
  const genres = genreIds.flatMap((genreId) => {
    const genre = genreById.get(genreId);
    return genre ? [genre] : [];
  });
  const posterPath = stringValue(value.poster_path);

  return {
    id,
    title: localizedTitle,
    originalTitle,
    overview: stringValue(value.overview),
    releaseDate,
    year: Number(releaseDate.slice(0, 4)),
    posterUrl: posterPath.startsWith("/") ? `${TMDB_IMAGE_BASE}${posterPath}` : null,
    genres,
    detailsUrl: `https://www.themoviedb.org/movie/${id}?language=${TMDB_LANGUAGES[locale]}`,
  };
}

export function readTmdbToken(environment: object): string | null {
  const value: unknown = Reflect.get(environment, "TMDB_API_TOKEN");
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function fetchReleaseCatalog(
  token: string,
  locale: Locale,
  today: string,
): Promise<ReleaseCatalog> {
  if (!token.trim()) throw new ReleaseCatalogUnavailableError("TMDB_API_TOKEN is not configured");
  if (!isDateKey(today)) throw new RangeError(`Invalid release date: ${today}`);

  const [genres, firstPage] = await Promise.all([
    fetchGenres(token, locale),
    fetchDiscoverPage(token, locale, today, 1),
  ]);
  const pages = [firstPage];

  for (let start = 2; start <= firstPage.totalPages; start += TMDB_PAGE_CONCURRENCY) {
    const pageNumbers = Array.from(
      { length: Math.min(TMDB_PAGE_CONCURRENCY, firstPage.totalPages - start + 1) },
      (_, index) => start + index,
    );
    pages.push(...await Promise.all(
      pageNumbers.map((page) => fetchDiscoverPage(token, locale, today, page)),
    ));
  }

  const genreById = new Map(genres.map((genre) => [genre.id, genre]));
  const releasesById = new Map<number, UpcomingRelease>();
  pages.flatMap((page) => page.results).forEach((value) => {
    const release = mapRelease(value, genreById, locale, today);
    if (release && !releasesById.has(release.id)) releasesById.set(release.id, release);
  });

  const releases = [...releasesById.values()].sort((left, right) => (
    left.releaseDate.localeCompare(right.releaseDate)
    || left.title.localeCompare(right.title, locale)
  ));

  return {
    schemaVersion: RELEASE_CATALOG_SCHEMA_VERSION,
    locale,
    generatedFor: today,
    updatedAt: new Date().toISOString(),
    genres,
    releases,
  };
}

export async function getCachedReleaseCatalog(
  kv: KVNamespace,
  locale: Locale,
): Promise<ReleaseCatalog | null> {
  const value: unknown = await kv.get(releaseCacheKey(locale), "json");
  return isReleaseCatalog(value, locale) ? value : null;
}

export async function setCachedReleaseCatalog(
  kv: KVNamespace,
  catalog: ReleaseCatalog,
): Promise<void> {
  await kv.put(releaseCacheKey(catalog.locale), JSON.stringify(catalog));
}

export async function refreshReleaseCatalog(
  kv: KVNamespace,
  token: string,
  locale: Locale,
  today: string,
): Promise<ReleaseCatalog> {
  const catalog = await fetchReleaseCatalog(token, locale, today);
  await setCachedReleaseCatalog(kv, catalog);
  return catalog;
}

export async function getAvailableReleaseCatalog(
  kv: KVNamespace,
  token: string | null,
  locale: Locale,
  today: string,
): Promise<ReleaseCatalog> {
  const cached = await getCachedReleaseCatalog(kv, locale);
  if (cached) return cached;
  if (!token) throw new ReleaseCatalogUnavailableError("TMDB_API_TOKEN is not configured");
  return refreshReleaseCatalog(kv, token, locale, today);
}

export async function refreshReleaseCatalogIfStale(
  kv: KVNamespace,
  token: string | null,
  locale: Locale,
  today: string,
): Promise<ReleaseCatalog | null> {
  const cached = await getCachedReleaseCatalog(kv, locale);
  if (cached && !isReleaseCatalogStale(cached)) return null;
  if (!token) throw new ReleaseCatalogUnavailableError("TMDB_API_TOKEN is not configured");
  return refreshReleaseCatalog(kv, token, locale, today);
}
