import {
  getMultikinoCinema,
  MULTIKINO_ORIGIN,
  type MultikinoCinema,
} from "../multikino.ts";
import type { ScreeningLanguage, ScreeningPresentation } from "../screening-language.ts";
import { warsawDate } from "../warsaw-date.ts";
import { createMultikinoClient, type MultikinoClient } from "../../server/multikino.ts";

type MultikinoAttribute = {
  attributeType?: unknown;
  name?: unknown;
  shortName?: unknown;
  value?: unknown;
};

type MultikinoScreening = {
  time: string;
  link?: string;
  language?: ScreeningLanguage;
  presentation?: ScreeningPresentation;
  providerRef: {
    provider: "multikino";
    cinema: MultikinoCinema;
    screeningId: string;
  };
};

export type MultikinoShow = {
  title: string;
  link?: string;
  poster?: string;
  screenings: MultikinoScreening[];
  screeningLinksAreExplicit: true;
};

type ParseOptions = {
  client?: MultikinoClient;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function validMultikinoUrl(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;

  try {
    const url = new URL(raw, MULTIKINO_ORIGIN);
    if (url.protocol !== "https:" || url.hostname !== "www.multikino.pl") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function bookingUrl(
  value: unknown,
  cinemaId: string,
  filmId: string,
  screeningId: string,
): string | undefined {
  const urlValue = validMultikinoUrl(value);
  if (!urlValue) return undefined;

  const url = new URL(urlValue);
  const expectedPath = `/rezerwacja-biletow/podsumowanie/${cinemaId}/${filmId}/${screeningId}`;
  return url.pathname === expectedPath ? url.toString() : undefined;
}

function screeningTime(session: Record<string, unknown>, day: string): string | undefined {
  for (const candidate of [session.showTimeWithTimeZone, session.startTime]) {
    const value = text(candidate);
    const match = value?.match(/^(\d{4}-\d{2}-\d{2})T((?:[01]\d|2[0-3]):[0-5]\d)/);
    if (match?.[1] === day) return match[2];
  }
  return undefined;
}

function attributes(value: unknown): MultikinoAttribute[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function attributeText(attribute: MultikinoAttribute): string {
  return [attribute.name, attribute.shortName, attribute.value]
    .map(text)
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function languageFromAttributes(value: unknown): ScreeningLanguage | undefined {
  const languageAttributes = attributes(value).filter(
    (attribute) => text(attribute.attributeType)?.toLowerCase() === "language",
  );
  if (languageAttributes.length === 0) return undefined;

  const combined = languageAttributes.map(attributeText).join(" ");
  const upper = combined.toLocaleUpperCase("pl-PL");
  const language: ScreeningLanguage = {};

  if (/NAPISY|SUBTITLE/.test(upper)) language.subtitled = true;
  if (/DUBBING|DUBBED/.test(upper)) language.dubbed = true;
  if (/ANGIELSK|ENGLISH/.test(upper)) {
    language.subtitled = true;
    language.subtitleLanguages = ["en"];
  }

  const explicitAudioLanguage = languageAttributes
    .map((attribute) => text(attribute.value)?.toLowerCase())
    .find((candidate) => candidate && /^[a-z]{2}$/.test(candidate));
  if (explicitAudioLanguage) language.audioLanguage = explicitAudioLanguage;

  return Object.keys(language).length > 0 ? language : undefined;
}

function presentationFromAttributes(value: unknown): ScreeningPresentation | undefined {
  const sessionAttributes = attributes(value).filter(
    (attribute) => text(attribute.attributeType)?.toLowerCase() === "session",
  );
  if (sessionAttributes.length === 0) return undefined;

  const presentation: ScreeningPresentation = {};
  for (const attribute of sessionAttributes) {
    const values = [attribute.value, attribute.shortName, attribute.name]
      .map(text)
      .filter((candidate): candidate is string => Boolean(candidate));
    const printType = values.find((candidate) => /^(2D|3D)$/i.test(candidate));
    if (!presentation.printType && printType) presentation.printType = printType.toUpperCase();
    if (!presentation.soundType && values.some((candidate) => /\bATMOS\b/i.test(candidate))) {
      presentation.soundType = "ATMOS";
    }
  }

  return Object.keys(presentation).length > 0 ? presentation : undefined;
}

function normalizedDay(value?: string | Date): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return warsawDate(value instanceof Date ? value : undefined);
}

export async function parseMultikinoCinema(
  cinema: MultikinoCinema,
  date?: string | Date,
  options: ParseOptions = {},
): Promise<MultikinoShow[]> {
  const config = getMultikinoCinema(cinema);
  const day = normalizedDay(date);
  const client = options.client ?? createMultikinoClient();
  const payload = await client.getShowings(config.cinemaId, day);

  if (!isRecord(payload) || payload.responseCode !== 0 || !Array.isArray(payload.result)) {
    throw new Error(`${config.name} returned an invalid schedule response`);
  }

  const shows = new Map<string, MultikinoShow>();
  const screeningIds = new Map<string, Set<string>>();

  for (const rawFilm of payload.result) {
    if (!isRecord(rawFilm)) continue;
    const filmId = text(rawFilm.filmId);
    const title = text(rawFilm.filmTitle);
    if (!filmId || !title || !Array.isArray(rawFilm.showingGroups)) continue;

    let show = shows.get(filmId);
    if (!show) {
      show = {
        title,
        link: validMultikinoUrl(rawFilm.filmUrl),
        poster: validMultikinoUrl(rawFilm.posterImageSrc),
        screenings: [],
        screeningLinksAreExplicit: true,
      };
      shows.set(filmId, show);
      screeningIds.set(filmId, new Set());
    }

    for (const group of rawFilm.showingGroups) {
      if (!isRecord(group) || !Array.isArray(group.sessions)) continue;
      for (const session of group.sessions) {
        if (!isRecord(session)) continue;
        const screeningId = text(session.sessionId);
        const time = screeningTime(session, day);
        if (!screeningId || !/^\d+$/.test(screeningId) || !time) continue;
        if (screeningIds.get(filmId)?.has(screeningId)) continue;
        screeningIds.get(filmId)?.add(screeningId);

        const canBook = session.isBookingAvailable === true && session.isSoldOut !== true;
        show.screenings.push({
          time,
          link: canBook
            ? bookingUrl(session.bookingUrl, config.cinemaId, filmId, screeningId)
            : undefined,
          language: languageFromAttributes(session.attributes),
          presentation: presentationFromAttributes(session.attributes),
          providerRef: {
            provider: "multikino",
            cinema,
            screeningId,
          },
        });
      }
    }
  }

  return [...shows.values()]
    .filter((show) => show.screenings.length > 0)
    .map((show) => ({
      ...show,
      screenings: show.screenings.sort(
        (a, b) => a.time.localeCompare(b.time) || a.providerRef.screeningId.localeCompare(b.providerRef.screeningId),
      ),
    }));
}
