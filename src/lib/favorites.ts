import type { Show } from "./normalize.ts";
import {
  normalizeScreeningLanguage,
  screeningFingerprint,
  type Screening,
  type ScreeningLanguage,
} from "./screening-language.ts";

export const FAVORITES_STORAGE_KEY = "kinoradar:favorites:v3";
export const FAVORITES_CHANGED_EVENT = "kinoradar:favorites-changed";
export const MAX_FAVORITES = 20;

export type FavoriteFilm = ScreeningLanguage & {
  title: string;
  normalizedTitle: string;
  date: string;
  time: string;
  cinema: string;
  source?: string;
  link?: string;
  poster?: string;
  addedAt: string;
};

type SharedFavoriteV3 = {
  t: string;
  d: string;
  h: string;
  c: string;
  o?: string;
  a?: string;
  s?: string[];
  p?: boolean;
  u?: boolean;
};

type SharedFavoritesPayloadV3 = {
  v: 3;
  films: SharedFavoriteV3[];
};

export function normalizeFilmTitle(title: string): string {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pl").replace(/\s+/g, " ").trim();
}

export function favoriteKey(
  title: string,
  date: string,
  time: string,
  cinema: string,
  language: ScreeningLanguage = {},
  source?: string,
): string {
  return `${date}|${source?.trim() || cinema.trim()}|${normalizeFilmTitle(title)}|${screeningFingerprint({ time, ...language })}`;
}

export function favoriteFilmKey(film: FavoriteFilm): string {
  return favoriteKey(film.title, film.date, film.time, film.cinema, film, film.source);
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function sanitizeFavorites(value: unknown): FavoriteFilm[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: FavoriteFilm[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Partial<FavoriteFilm>;
    if (typeof raw.title !== "string" || !raw.title.trim() || raw.title.length > 200 || !isDate(raw.date) || typeof raw.time !== "string" || !raw.time.trim() || typeof raw.cinema !== "string" || !raw.cinema.trim()) continue;
    const language = normalizeScreeningLanguage({
      audioLanguage: raw.audioLanguage,
      subtitleLanguages: raw.subtitleLanguages,
      subtitled: typeof raw.subtitled === "boolean" ? raw.subtitled : undefined,
      dubbed: typeof raw.dubbed === "boolean" ? raw.dubbed : undefined,
    });
    const film: FavoriteFilm = {
      title: raw.title.trim(),
      normalizedTitle: normalizeFilmTitle(raw.title),
      date: raw.date,
      time: raw.time.trim(),
      cinema: raw.cinema.trim(),
      source: typeof raw.source === "string" ? raw.source.trim() || undefined : undefined,
      link: typeof raw.link === "string" ? raw.link : undefined,
      poster: typeof raw.poster === "string" ? raw.poster : undefined,
      addedAt: typeof raw.addedAt === "string" ? raw.addedAt : new Date().toISOString(),
      ...language,
    };
    const key = favoriteFilmKey(film);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(film);
    if (result.length === MAX_FAVORITES) break;
  }
  return result;
}

export function favoriteFromShow(show: Show, date: string, screening: Screening): FavoriteFilm {
  return {
    title: show.canonicalTitle,
    normalizedTitle: normalizeFilmTitle(show.canonicalTitle),
    date,
    time: screening.time,
    cinema: show.cinema,
    source: show.source,
    link: screening.link || show.link,
    poster: show.poster,
    addedAt: new Date().toISOString(),
    ...normalizeScreeningLanguage(screening),
  };
}

export function encodeSharedFavorites(favorites: FavoriteFilm[]): string {
  const payload: SharedFavoritesPayloadV3 = {
    v: 3,
    films: favorites.slice(0, MAX_FAVORITES).map((film) => ({
      t: film.title,
      d: film.date,
      h: film.time,
      c: film.cinema,
      ...(film.source ? { o: film.source } : {}),
      ...(film.audioLanguage ? { a: film.audioLanguage } : {}),
      ...(film.subtitleLanguages !== undefined ? { s: film.subtitleLanguages } : {}),
      ...(film.subtitled !== undefined ? { p: film.subtitled } : {}),
      ...(film.dubbed !== undefined ? { u: film.dubbed } : {}),
    })),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSharedFavorites(encoded: string): FavoriteFilm[] {
  if (!encoded || encoded.length > 8_000) return [];
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SharedFavoritesPayloadV3>;
    if (payload.v !== 3 || !Array.isArray(payload.films)) return [];
    return sanitizeFavorites(payload.films.map((film) => ({
      title: film?.t,
      date: film?.d,
      time: film?.h,
      cinema: film?.c,
      source: film?.o,
      audioLanguage: film?.a,
      subtitleLanguages: film?.s,
      subtitled: film?.p,
      dubbed: film?.u,
      addedAt: new Date().toISOString(),
    })));
  } catch {
    return [];
  }
}
