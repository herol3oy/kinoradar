import {
  CINEMA_CITY_ORIGIN,
  getCinemaCityCinema,
  type CinemaCityCinema,
} from "../cinema-city.ts";
import type { ScreeningLanguage, ScreeningPresentation } from "../screening-language.ts";
import { normalizeWarsawDate, warsawDate } from "../warsaw-date.ts";
import { createCinemaCityClient, type CinemaCityClient } from "../../server/cinema-city.ts";

type CinemaCityScreening = {
  time: string;
  link?: string;
  language?: ScreeningLanguage;
  presentation?: ScreeningPresentation;
  providerRef: {
    provider: "cinema-city";
    cinema: CinemaCityCinema;
    screeningId: string;
  };
};

export type CinemaCityShow = {
  title: string;
  link?: string;
  poster?: string;
  screenings: CinemaCityScreening[];
  screeningLinksAreExplicit: true;
};

type ParseOptions = { client?: CinemaCityClient };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(text).filter((item): item is string => Boolean(item))
    : [];
}

function languageCodes(value: unknown): string[] {
  return [...new Set(stringList(value)
    .map((item) => item.toLowerCase())
    .filter((item) => /^[a-z]{2}$/.test(item)))];
}

function validCinemaCityUrl(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw, CINEMA_CITY_ORIGIN);
    return url.protocol === "https:" && url.hostname === "www.cinema-city.pl"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function bookingUrl(value: unknown, screeningId: string): string | undefined {
  const valid = validCinemaCityUrl(value);
  if (!valid) return undefined;
  const url = new URL(valid);
  return url.pathname === `/pl/booking-router/launch/${screeningId}`
    ? url.toString()
    : undefined;
}

function screeningTime(event: Record<string, unknown>, day: string): string | undefined {
  if (text(event.businessDay) !== day) return undefined;
  const match = text(event.eventDateTime)?.match(
    /^(\d{4}-\d{2}-\d{2})T((?:[01]\d|2[0-3]):[0-5]\d)/,
  );
  return match?.[1] === day ? match[2] : undefined;
}

function languageFromEvent(event: Record<string, unknown>): ScreeningLanguage | undefined {
  const attributes = new Set(stringList(event.attributeIds).map((item) => item.toLowerCase()));
  const languages = isRecord(event.languages) ? event.languages : {};
  const original = languageCodes(languages.original);
  const dubbed = languageCodes(languages.dubbed);
  const subtitles = languageCodes(languages.subtitles);
  const language: ScreeningLanguage = {};

  const audioLanguage = dubbed[0] ?? original[0];
  if (audioLanguage) language.audioLanguage = audioLanguage;
  if (dubbed.length > 0 || attributes.has("dubbed")) language.dubbed = true;
  if (subtitles.length > 0) language.subtitleLanguages = subtitles;
  if (subtitles.length > 0 || attributes.has("subbed")) language.subtitled = true;

  return Object.keys(language).length > 0 ? language : undefined;
}

function presentationFromEvent(event: Record<string, unknown>): ScreeningPresentation | undefined {
  const attributes = new Set(stringList(event.attributeIds).map((item) => item.toLowerCase()));
  const presentation: ScreeningPresentation = {};

  if (attributes.has("3d")) presentation.printType = "3D";
  else if (attributes.has("2d")) presentation.printType = "2D";
  if (attributes.has("dolby-atmos")) presentation.soundType = "ATMOS";

  const featureNames = [
    ["imax", "IMAX"],
    ["4dx", "4DX"],
    ["screenx", "SCREENX"],
    ["vip", "VIP"],
    ["laser-barco", "LASER BARCO"],
  ] as const;
  const screenFeatures = featureNames
    .filter(([attribute]) => attributes.has(attribute))
    .map(([, label]) => label);
  if (screenFeatures.length > 0) {
    presentation.format = screenFeatures[0];
    presentation.screenFeatures = screenFeatures;
  }

  return Object.keys(presentation).length > 0 ? presentation : undefined;
}

function normalizedDay(value?: string | Date): string {
  if (typeof value === "string") return normalizeWarsawDate(value);
  return warsawDate(value instanceof Date ? value : undefined);
}

export async function parseCinemaCityCinema(
  cinema: CinemaCityCinema,
  date?: string | Date,
  options: ParseOptions = {},
): Promise<CinemaCityShow[]> {
  const config = getCinemaCityCinema(cinema);
  const day = normalizedDay(date);
  const client = options.client ?? createCinemaCityClient();
  const payload = await client.getShowings(config.cinemaId, day);

  if (!isRecord(payload) || !isRecord(payload.body)
    || !Array.isArray(payload.body.films) || !Array.isArray(payload.body.events)) {
    throw new Error(`${config.name} returned an invalid schedule response`);
  }

  const shows = new Map<string, CinemaCityShow>();
  for (const film of payload.body.films) {
    if (!isRecord(film)) continue;
    const filmId = text(film.id);
    const title = text(film.name);
    if (!filmId || !title) continue;
    shows.set(filmId, {
      title,
      link: validCinemaCityUrl(film.link),
      poster: validCinemaCityUrl(film.posterLink),
      screenings: [],
      screeningLinksAreExplicit: true,
    });
  }

  const seenScreenings = new Set<string>();
  for (const event of payload.body.events) {
    if (!isRecord(event)) continue;
    const screeningId = text(event.id);
    const filmId = text(event.filmId);
    const time = screeningTime(event, day);
    const show = filmId ? shows.get(filmId) : undefined;
    if (!screeningId || !/^\d+$/.test(screeningId) || !show || !time
      || text(event.cinemaId) !== config.cinemaId || seenScreenings.has(screeningId)) continue;
    seenScreenings.add(screeningId);

    const compositeBookingLink = isRecord(event.compositeBookingLink)
      ? event.compositeBookingLink
      : undefined;
    const canBook = event.soldOut !== true && compositeBookingLink?.blockOnlineSales !== true;
    show.screenings.push({
      time,
      link: canBook ? bookingUrl(event.bookingRouterLaunchLink, screeningId) : undefined,
      language: languageFromEvent(event),
      presentation: presentationFromEvent(event),
      providerRef: { provider: "cinema-city", cinema, screeningId },
    });
  }

  return [...shows.values()]
    .filter((show) => show.screenings.length > 0)
    .map((show) => ({
      ...show,
      screenings: show.screenings.sort(
        (a, b) => a.time.localeCompare(b.time)
          || a.providerRef.screeningId.localeCompare(b.providerRef.screeningId),
      ),
    }));
}
