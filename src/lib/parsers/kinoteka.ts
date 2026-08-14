import {
  KINOTEKA_CINEMA_ID,
  kinotekaApiUrl,
  kinotekaBookingUrl,
} from "../kinoteka.ts";
import { parseLanguageCodes } from "../screening-language.ts";
import { fetchWithTimeout } from "../../server/fetch.ts";

type KinotekaScreening = {
  id?: unknown;
  movieId?: unknown;
  screeningTimeFrom?: unknown;
  language?: unknown;
  subtitles?: unknown;
  subtitles2?: unknown;
  speakingType?: unknown;
  release?: unknown;
  printType?: unknown;
  soundType?: unknown;
  format?: unknown;
  screenFeatures?: unknown;
};

type KinotekaMovie = {
  id?: unknown;
  title?: unknown;
  shortTitle?: unknown;
  posters?: unknown;
};

function dateKey(value?: string | Date): string {
  return typeof value === "string"
    ? value
    : value
      ? value.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Kinoteka returned ${response.status}`);
  return response.json() as Promise<T>;
}

function records(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const wrapped = value as { items?: unknown; data?: unknown; screenings?: unknown };
  if (Array.isArray(wrapped.items)) return wrapped.items;
  if (Array.isArray(wrapped.data)) return wrapped.data;
  if (Array.isArray(wrapped.screenings)) return wrapped.screenings;
  return [];
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function localTime(value: unknown): string | undefined {
  const match = typeof value === "string" ? /T([01]\d|2[0-3]):([0-5]\d)/.exec(value) : null;
  return match ? `${match[1]}:${match[2]}` : undefined;
}

function poster(movie: KinotekaMovie): string | undefined {
  return Array.isArray(movie.posters)
    ? movie.posters.find((value): value is string => typeof value === "string" && /^https:\/\//i.test(value))
    : undefined;
}

function languageMetadata(screening: KinotekaScreening) {
  const audioLanguage = parseLanguageCodes(screening.language)[0];
  const subtitleLanguages = parseLanguageCodes([screening.subtitles, screening.subtitles2]);
  const speakingType = text(screening.speakingType)?.toLocaleUpperCase("en");
  const release = text(screening.release) ?? "";
  const dubbed = speakingType?.includes("DUB") || /dubbing/iu.test(release)
    ? true
    : speakingType === "ORG"
      ? false
      : undefined;

  return {
    ...(audioLanguage ? { audioLanguage } : {}),
    ...(subtitleLanguages.length ? { subtitleLanguages, subtitled: true } : {}),
    ...(dubbed !== undefined ? { dubbed } : {}),
  };
}

function presentationMetadata(screening: KinotekaScreening) {
  const screenFeatures = Array.isArray(screening.screenFeatures)
    ? screening.screenFeatures.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    : [];
  const printType = text(screening.printType);
  const soundType = text(screening.soundType);
  const format = text(screening.format);
  return printType || soundType || format || screenFeatures.length
    ? {
        presentation: {
          ...(printType ? { printType } : {}),
          ...(soundType ? { soundType } : {}),
          ...(format ? { format } : {}),
          ...(screenFeatures.length ? { screenFeatures } : {}),
        },
      }
    : {};
}

export async function parseKinoteka(date?: string | Date) {
  const day = dateKey(date);
  const dateTimeFrom = `${day}T00:00:00.000`;
  const dateTimeTo = `${day}T23:59:59.999`;
  const screeningsUrl = new URL(kinotekaApiUrl(`/cinema/${KINOTEKA_CINEMA_ID}/screening`));
  screeningsUrl.searchParams.set("dateTimeFrom", dateTimeFrom);
  screeningsUrl.searchParams.set("dateTimeTo", dateTimeTo);

  const rawScreenings = records(await fetchJson<unknown>(screeningsUrl.toString())) as KinotekaScreening[];
  const screenings = rawScreenings.filter((screening) =>
    typeof screening?.id === "string"
    && typeof screening.movieId === "string"
    && Boolean(localTime(screening.screeningTimeFrom))
  );
  if (!screenings.length) return [];

  const movieIds = [...new Set(screenings.map((screening) => screening.movieId as string))];
  const moviesUrl = new URL(kinotekaApiUrl("/movie"));
  moviesUrl.searchParams.set("cinemaId", KINOTEKA_CINEMA_ID);
  moviesUrl.searchParams.set("dateTimeFrom", dateTimeFrom);
  moviesUrl.searchParams.set("dateTimeTo", dateTimeTo);
  const rawMovies = records(await fetchJson<unknown>(moviesUrl.toString())) as KinotekaMovie[];
  const movies = new Map<string, KinotekaMovie>();

  for (const movie of rawMovies) {
    if (typeof movie?.id === "string" && movieIds.includes(movie.id)) {
      movies.set(movie.id, movie);
    }
  }
  if (!movies.size) throw new Error("Kinoteka movie details unavailable");

  const missingMovieIds = movieIds.filter((movieId) => !movies.has(movieId));
  if (missingMovieIds.length) {
    console.error(JSON.stringify({
      message: "Kinoteka bulk movie response incomplete",
      date: day,
      missingMovieIds,
    }));
  }

  const shows = movieIds.flatMap((movieId) => {
    const movie = movies.get(movieId);
    if (!movie) return [];
    const title = text(movie.shortTitle) ?? text(movie.title);
    if (!title) return [];

    const movieScreenings = screenings
      .filter((screening) => screening.movieId === movieId)
      .map((screening) => {
        const screeningId = screening.id as string;
        return {
          time: localTime(screening.screeningTimeFrom)!,
          link: kinotekaBookingUrl(screeningId),
          providerRef: { provider: "kinoteka" as const, screeningId },
          ...languageMetadata(screening),
          ...presentationMetadata(screening),
        };
      });

    return [{
      title,
      poster: poster(movie),
      screenings: movieScreenings,
    }];
  });

  const grouped = new Map<string, (typeof shows)[number]>();
  for (const show of shows) {
    const key = show.title.toLocaleLowerCase("pl");
    const existing = grouped.get(key);
    if (existing) {
      existing.screenings.push(...show.screenings);
      existing.poster ||= show.poster;
    } else {
      grouped.set(key, { ...show, screenings: [...show.screenings] });
    }
  }
  return [...grouped.values()];
}

export const siteName = "Kinoteka";
