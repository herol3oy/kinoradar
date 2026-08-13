import {
  HELIOS_BLUE_CITY,
  HELIOS_ORIGIN,
  HELIOS_TICKETS_ORIGIN,
  heliosScreeningsUrl,
} from "../helios.ts";
import type { ScreeningLanguage, ScreeningPresentation } from "../screening-language.ts";
import { normalizeWarsawDate, warsawDate } from "../warsaw-date.ts";
import { fetchWithTimeout } from "../../server/fetch.ts";

type HeliosScreening = {
  time: string;
  link: string;
  language?: ScreeningLanguage;
  presentation?: ScreeningPresentation;
  providerRef: { provider: "helios"; screeningId: string };
};

export type HeliosShow = {
  title: string;
  link?: string;
  poster?: string;
  screenings: HeliosScreening[];
  screeningLinksAreExplicit: true;
};

type ParseOptions = {
  fetcher?: typeof fetch;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function integerId(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  const raw = text(value);
  return raw && /^\d+$/.test(raw) ? raw : undefined;
}

function validUuid(value: unknown): string | undefined {
  const raw = text(value);
  return raw && UUID.test(raw) ? raw : undefined;
}

function validPoster(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname === "img.helios.pl" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function itemFlags(item: Record<string, unknown>): string[] {
  if (!Array.isArray(item.flags)) return [];
  return item.flags
    .filter(isRecord)
    .map((flag) => text(flag.name))
    .filter((flag): flag is string => Boolean(flag));
}

function moviePrint(screening: Record<string, unknown>): Record<string, unknown> | undefined {
  if (isRecord(screening.moviePrint)) return screening.moviePrint;
  if (!Array.isArray(screening.screeningMovies)) return undefined;
  const first = screening.screeningMovies.find(isRecord);
  return first && isRecord(first.moviePrint) ? first.moviePrint : undefined;
}

function languageFor(
  item: Record<string, unknown>,
  print: Record<string, unknown> | undefined,
): ScreeningLanguage | undefined {
  const flags = itemFlags(item).join(" ").toLocaleUpperCase("pl-PL");
  const release = text(print?.printRelease)?.toLocaleUpperCase("pl-PL") ?? "";
  const speaking = text(print?.speakingTypeLabel)?.toLocaleUpperCase("pl-PL") ?? "";
  const combined = `${flags} ${release} ${speaking}`;
  const language: ScreeningLanguage = {};

  if (/\b(NAP|NAPISY)\b/.test(combined)) language.subtitled = true;
  if (/\b(DUB|DUBBING)\b/.test(combined)) language.dubbed = true;
  if (/WERSJA JĘZYKOWA UA|WERSJA JEZYKOWA UA/.test(combined)) {
    language.audioLanguage = "uk";
  }

  return Object.keys(language).length > 0 ? language : undefined;
}

function presentationFor(
  screening: Record<string, unknown>,
  print: Record<string, unknown> | undefined,
): ScreeningPresentation | undefined {
  const presentation: ScreeningPresentation = {};
  const printType = text(print?.printType);
  const soundType = text(print?.soundType);
  const feature = isRecord(screening.cinemaScreen) ? text(screening.cinemaScreen.feature) : undefined;

  if (printType && /^(2D|3D)$/i.test(printType)) presentation.printType = printType.toUpperCase();
  if (soundType && soundType !== "5.1") presentation.soundType = soundType.toUpperCase();
  if (feature) {
    const normalized = feature.toUpperCase();
    presentation.format = normalized;
    presentation.screenFeatures = [normalized];
  }

  return Object.keys(presentation).length > 0 ? presentation : undefined;
}

function screeningTime(value: unknown, day: string): string | undefined {
  const match = text(value)?.match(/^(\d{4}-\d{2}-\d{2}) ((?:[01]\d|2[0-3]):[0-5]\d):\d{2}$/);
  return match?.[1] === day ? match[2] : undefined;
}

function itemUrl(item: Record<string, unknown>, kind: "movie" | "event"): string | undefined {
  const id = integerId(item.id);
  const slug = text(item.slug);
  if (!id || !slug || !/^[a-z0-9-]+$/i.test(slug)) return undefined;
  const segment = kind === "movie" ? "filmy" : "wydarzenie";
  return new URL(`${HELIOS_BLUE_CITY.path}/${segment}/${slug}-${id}`, HELIOS_ORIGIN).toString();
}

function bookingUrl(
  screeningId: string,
  item: Record<string, unknown>,
  cinemaSourceId: string,
): string | undefined {
  const itemId = integerId(item.id);
  const itemSourceId = validUuid(item.sourceId);
  if (!itemId || !itemSourceId || cinemaSourceId !== HELIOS_BLUE_CITY.cinemaSourceId) return undefined;

  const url = new URL(`/screen/${screeningId}`, HELIOS_TICKETS_ORIGIN);
  url.searchParams.set("cinemaId", cinemaSourceId);
  url.searchParams.set("backUrl", `${HELIOS_ORIGIN}${HELIOS_BLUE_CITY.path}/repertuar`);
  url.searchParams.set("item_id", itemSourceId);
  url.searchParams.set("item_source_id", itemId);
  return url.toString();
}

function normalizedDay(value?: string | Date): string {
  if (typeof value === "string") return normalizeWarsawDate(value);
  return warsawDate(value instanceof Date ? value : undefined);
}

export async function parseHeliosBlueCity(
  date?: string | Date,
  options: ParseOptions = {},
): Promise<HeliosShow[]> {
  const day = normalizedDay(date);
  const fetcher = options.fetcher ?? fetchWithTimeout;
  const response = await fetcher(heliosScreeningsUrl(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Helios Blue City returned ${response.status}`);

  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.status !== 200 || !isRecord(payload.data)
    || !isRecord(payload.data.screenings) || !isRecord(payload.data.movies)
    || !isRecord(payload.data.events)) {
    throw new Error("Helios Blue City returned an invalid schedule response");
  }

  const daySchedule = payload.data.screenings[day];
  if (daySchedule === undefined) return [];
  if (!isRecord(daySchedule)) {
    throw new Error("Helios Blue City returned an invalid day schedule");
  }

  const shows: HeliosShow[] = [];
  for (const [key, rawGroup] of Object.entries(daySchedule)) {
    if (!/^[me]\d+$/.test(key) || !isRecord(rawGroup) || !Array.isArray(rawGroup.screenings)) continue;
    const kind = key.startsWith("m") ? "movie" : "event";
    const rawItem = kind === "movie" ? payload.data.movies[key] : payload.data.events[key];
    if (!isRecord(rawItem)) continue;

    const title = text(kind === "movie" ? rawItem.title : rawItem.name);
    if (!title) continue;
    const screenings: HeliosScreening[] = [];
    const seen = new Set<string>();

    for (const rawScreening of rawGroup.screenings) {
      if (!isRecord(rawScreening)) continue;
      const screeningId = validUuid(rawScreening.sourceId);
      const cinemaSourceId = validUuid(rawScreening.cinemaSourceId);
      const time = screeningTime(rawScreening.timeFrom, day);
      if (!screeningId || !cinemaSourceId || !time || seen.has(screeningId)) continue;
      const link = bookingUrl(screeningId, rawItem, cinemaSourceId);
      if (!link) continue;
      seen.add(screeningId);
      const print = moviePrint(rawScreening);
      screenings.push({
        time,
        link,
        language: languageFor(rawItem, print),
        presentation: presentationFor(rawScreening, print),
        providerRef: { provider: "helios", screeningId },
      });
    }

    if (screenings.length === 0) continue;
    const posterPhoto = isRecord(rawItem.posterPhoto) ? rawItem.posterPhoto : undefined;
    shows.push({
      title,
      link: itemUrl(rawItem, kind),
      poster: validPoster(posterPhoto?.url),
      screenings: screenings.sort(
        (a, b) => a.time.localeCompare(b.time) || a.providerRef.screeningId.localeCompare(b.providerRef.screeningId),
      ),
      screeningLinksAreExplicit: true,
    });
  }

  return shows;
}

export const siteName = HELIOS_BLUE_CITY.name;
