import type { Show } from "./normalize.ts";

export const FILMWEB_POPULAR_SCHEMA_VERSION = 1;
export const FILMWEB_IMAGE_BASE = "https://fwcdn.pl/fpo";
export const FILMWEB_POSTER_SIZE = "3";

export type FilmwebFilm = {
  id: number;
  title: string;
  originalTitle: string;
  year: number | null;
  subType: string;
  posterUrl: string | null;
};

export type PopularFilmsCache = {
  schemaVersion: number;
  updatedAt: string;
  films: FilmwebFilm[];
};

export function filmwebPosterUrl(posterPath: unknown): string | null {
  if (typeof posterPath !== "string") return null;
  const path = posterPath.trim();
  if (!path.startsWith("/") || !path.includes("$")) return null;
  return `${FILMWEB_IMAGE_BASE}${path.replace("$", FILMWEB_POSTER_SIZE)}`;
}

export function filmwebTitleKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Łł]/g, "l")
    .toLocaleLowerCase("pl")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleMatchKeys(film: FilmwebFilm): string[] {
  return [film.title, film.originalTitle]
    .map((title) => filmwebTitleKey(title ?? ""))
    .filter((key, index, keys) => Boolean(key) && keys.indexOf(key) === index);
}

export function showTitleKey(show: Show): string {
  return filmwebTitleKey(show.canonicalTitle);
}

export function isFilmwebFilm(value: unknown): value is FilmwebFilm {
  if (!value || typeof value !== "object") return false;
  const film = value as Partial<FilmwebFilm>;
  return Number.isInteger(film.id) && Number(film.id) > 0
    && typeof film.title === "string" && Boolean(film.title.trim())
    && typeof film.originalTitle === "string"
    && (film.year === null || Number.isInteger(film.year))
    && typeof film.subType === "string"
    && (film.posterUrl === null || typeof film.posterUrl === "string");
}

export function isPopularFilmsCache(value: unknown): value is PopularFilmsCache {
  if (!value || typeof value !== "object") return false;
  const cache = value as Partial<PopularFilmsCache>;
  return cache.schemaVersion === FILMWEB_POPULAR_SCHEMA_VERSION
    && typeof cache.updatedAt === "string"
    && Number.isFinite(Date.parse(cache.updatedAt))
    && Array.isArray(cache.films) && cache.films.every(isFilmwebFilm);
}

export function isPopularFilmsCacheStale(
  cache: PopularFilmsCache,
  now: Date = new Date(),
): boolean {
  return now.getTime() - Date.parse(cache.updatedAt) >= 4 * 60 * 60 * 1000;
}
