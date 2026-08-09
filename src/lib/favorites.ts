import type { Show } from "./normalize";

export const FAVORITES_STORAGE_KEY = "kinoradar:favorites:v2";
export const FAVORITES_CHANGED_EVENT = "kinoradar:favorites-changed";
export const MAX_FAVORITES = 20;

export type FavoriteFilm = {
  title: string;
  normalizedTitle: string;
  date: string;
  time: string;
  cinema: string;
  link?: string;
  poster?: string;
  addedAt: string;
};

type SharedFavoritesPayloadV2 = {
  v: 2;
  films: Array<{ t: string; d: string; h: string; c: string }>;
};

export function normalizeFilmTitle(title: string): string {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pl").replace(/\s+/g, " ").trim();
}

export function favoriteKey(title: string, date: string, time: string, cinema: string): string {
  return `${date}|${time.trim()}|${cinema.trim()}|${normalizeFilmTitle(title)}`;
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
    const normalizedTitle = normalizeFilmTitle(raw.title);
    const key = favoriteKey(raw.title, raw.date, raw.time, raw.cinema);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      title: raw.title.trim(),
      normalizedTitle,
      date: raw.date,
      time: raw.time.trim(),
      cinema: raw.cinema.trim(),
      link: typeof raw.link === "string" ? raw.link : undefined,
      poster: typeof raw.poster === "string" ? raw.poster : undefined,
      addedAt: typeof raw.addedAt === "string" ? raw.addedAt : new Date().toISOString(),
    });
    if (result.length === MAX_FAVORITES) break;
  }
  return result;
}

export function favoriteFromShow(show: Show, date: string, time: string): FavoriteFilm {
  return {
    title: show.title,
    normalizedTitle: normalizeFilmTitle(show.title),
    date,
    time,
    cinema: show.cinema,
    link: show.link,
    poster: show.poster,
    addedAt: new Date().toISOString(),
  };
}

export function encodeSharedFavorites(favorites: FavoriteFilm[]): string {
  const payload: SharedFavoritesPayloadV2 = {
    v: 2,
    films: favorites.slice(0, MAX_FAVORITES).map((film) => ({ t: film.title, d: film.date, h: film.time, c: film.cinema })),
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
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SharedFavoritesPayloadV2>;
    if (payload.v !== 2 || !Array.isArray(payload.films)) return [];
    return sanitizeFavorites(payload.films.map((film) => ({
      title: film?.t,
      date: film?.d,
      time: film?.h,
      cinema: film?.c,
      addedAt: new Date().toISOString(),
    })));
  } catch {
    return [];
  }
}
