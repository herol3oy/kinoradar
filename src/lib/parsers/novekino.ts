import * as cheerio from "cheerio";
import {
  NOVEKINO_CONFIG,
  isNovekinoScreeningId,
  novekinoBookingUrl,
  novekinoPosterUrl,
  type NovekinoCinema,
} from "../novekino.ts";
import { parseScreeningTitle, type ScreeningLanguage } from "../screening-language.ts";
import { warsawDate } from "../warsaw-date.ts";
import { fetchWithTimeout } from "../../server/fetch.ts";
import {
  fetchNovekinoRepertoire,
  type NovekinoFetcher,
  type NovekinoRepertoireEvent,
} from "../../server/novekino.ts";

type NovekinoScreening = ScreeningLanguage & {
  time: string;
  link?: string;
  providerRef?: {
    provider: "novekino";
    cinema: NovekinoCinema;
    screeningId: string;
  };
  presentation?: { printType?: string };
};

type NovekinoShow = {
  title: string;
  filmId?: string;
  link?: string;
  poster?: string;
  screenings: NovekinoScreening[];
};

type ParseOptions = {
  fetcher?: NovekinoFetcher;
  now?: Date;
};

function dayKey(date: string | Date | undefined, now: Date): string {
  return typeof date === "string" ? date : warsawDate(date ?? now);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function positiveNumericId(value: unknown): string | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const id = String(value);
  return /^[1-9]\d*$/.test(id) ? id : undefined;
}

function eventId(value: unknown): string | undefined {
  const id = positiveNumericId(value) ?? "";
  return isNovekinoScreeningId(id) ? id : undefined;
}

function eventTime(value: unknown): string | undefined {
  const match = typeof value === "string" ? /T([01]\d|2[0-3]):([0-5]\d)/.exec(value) : null;
  return match ? `${match[1]}:${match[2]}` : undefined;
}

function eventFilmId(event: NovekinoRepertoireEvent): string | undefined {
  return positiveNumericId(event.details?.eventDetailUniqueNumber) ?? positiveNumericId(event.eventDetailId);
}

function eventLanguage(event: NovekinoRepertoireEvent, title: string): ScreeningLanguage {
  const fallback = parseScreeningTitle(title).language;
  const version = [event.details?.dubbing, event.details?.additionalInfo]
    .map(text)
    .filter(Boolean)
    .join(" ")
    .toLocaleUpperCase("pl");
  return {
    ...fallback,
    ...(/DUB/.test(version) ? { dubbed: true } : {}),
    ...(/NAP/.test(version) ? { subtitled: true } : {}),
  };
}

function eventPresentation(event: NovekinoRepertoireEvent) {
  const printType = event.details?.is_3D === true ? "3D" : event.details?.is_2D === true ? "2D" : undefined;
  return printType ? { presentation: { printType } } : {};
}

function absoluteUrl(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function screeningIdFromLink(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const id = new URL(value).searchParams.get("event_id") ?? "";
    return isNovekinoScreeningId(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

function showKey(show: Pick<NovekinoShow, "filmId" | "title">): string {
  if (show.filmId) return `film:${show.filmId}`;
  return `title:${parseScreeningTitle(show.title).canonicalTitle.toLocaleLowerCase("pl")}`;
}

function screeningKey(screening: NovekinoScreening): string {
  return screening.providerRef
    ? `${screening.providerRef.cinema}:${screening.providerRef.screeningId}`
    : `time:${screening.time}`;
}

function mergeScreenings(current: NovekinoScreening[], incoming: NovekinoScreening[]): NovekinoScreening[] {
  const merged = new Map(current.map((screening) => [screeningKey(screening), screening]));
  for (const screening of incoming) {
    const exactKey = screeningKey(screening);
    const existing = merged.get(exactKey);
    if (existing) {
      merged.set(exactKey, { ...screening, ...existing, link: existing.link ?? screening.link });
      continue;
    }
    if (!screening.providerRef && [...merged.values()].some((item) => item.time === screening.time)) continue;
    merged.set(exactKey, screening);
  }
  return [...merged.values()].sort((a, b) => a.time.localeCompare(b.time) || screeningKey(a).localeCompare(screeningKey(b)));
}

function parseTicketingEvents(
  events: NovekinoRepertoireEvent[],
  day: string,
  cinema: NovekinoCinema,
): NovekinoShow[] {
  const config = NOVEKINO_CONFIG[cinema];
  const groups = new Map<string, NovekinoShow>();

  for (const event of events) {
    if (typeof event.eventDateTime !== "string" || !event.eventDateTime.startsWith(`${day}T`)) continue;
    const id = eventId(event.eventId);
    const time = eventTime(event.eventDateTime);
    const title = text(event.eventTitle) ?? text(event.details?.shortName) ?? text(event.details?.name);
    if (!id || !time || !title) continue;

    const filmId = eventFilmId(event);
    const imageId = positiveNumericId(event.imageId) ?? positiveNumericId(event.details?.imageId);
    const show: NovekinoShow = {
      title,
      filmId,
      ...(filmId ? { link: `${config.publicBase}film.php?id=${filmId}` } : {}),
      ...(imageId ? { poster: novekinoPosterUrl(cinema, imageId) } : {}),
      screenings: [],
    };
    const key = showKey(show);
    const group = groups.get(key) ?? show;
    group.link ||= show.link;
    group.poster ||= show.poster;
    group.screenings = mergeScreenings(group.screenings, [{
      time,
      link: novekinoBookingUrl(cinema, id),
      providerRef: { provider: "novekino", cinema, screeningId: id },
      ...eventLanguage(event, title),
      ...eventPresentation(event),
    }]);
    groups.set(key, group);
  }

  return [...groups.values()];
}

async function parseNovekinoHtml(
  cinema: NovekinoCinema,
  day: string,
  fetcher: NovekinoFetcher,
): Promise<NovekinoShow[]> {
  const config = NOVEKINO_CONFIG[cinema];
  const url = `${config.publicBase}repertuar.php?data=${day}`;
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`Kino ${cinema} returned ${response.status}`);
  const $ = cheerio.load(await response.text());
  const shows: NovekinoShow[] = [];

  $("tr.repertoire-movie-tr").each((_, row) => {
    const titleAnchor = $(row).find(".repertoire-movie-title a").first();
    const title = titleAnchor.text().trim();
    if (!title) return;

    const link = absoluteUrl(titleAnchor.attr("href"), config.publicBase);
    const filmId = link ? positiveNumericId(new URL(link).searchParams.get("id")) : undefined;
    const poster = absoluteUrl(
      $(row).find(".repertoire-movie-poster img").first().attr("src"),
      "https://www.novekino.pl/",
    );
    const screenings: NovekinoScreening[] = [];

    $(row).find(".repertoire-movie-time").each((_, element) => {
      const time = String($(element).attr("data-hour") || $(element).text()).trim();
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
      const ticketLink = absoluteUrl(
        $(element).attr("data-buy-link") || $(element).attr("data-reserve-link"),
        config.ticketingBase,
      );
      const id = screeningIdFromLink(ticketLink);
      screenings.push({
        time,
        ...(ticketLink ? { link: ticketLink } : link ? { link } : {}),
        ...(id ? { providerRef: { provider: "novekino", cinema, screeningId: id } } : {}),
      });
    });

    shows.push({ title, filmId, link, poster, screenings });
  });

  return shows;
}

function mergeShows(primary: NovekinoShow[], enrichment: NovekinoShow[]): NovekinoShow[] {
  const merged = new Map(primary.map((show) => [showKey(show), show]));
  for (const incoming of enrichment) {
    const key = showKey(incoming);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, incoming);
      continue;
    }
    merged.set(key, {
      ...current,
      title: incoming.title || current.title,
      filmId: current.filmId ?? incoming.filmId,
      link: incoming.link ?? current.link,
      poster: incoming.poster ?? current.poster,
      screenings: mergeScreenings(current.screenings, incoming.screenings),
    });
  }
  return [...merged.values()];
}

export async function parseNovekinoCinema(
  cinema: NovekinoCinema,
  date?: string | Date,
  options: ParseOptions = {},
): Promise<NovekinoShow[]> {
  const now = options.now ?? new Date();
  const day = dayKey(date, now);
  const fetcher = options.fetcher ?? fetchWithTimeout;

  try {
    const shows = parseTicketingEvents(await fetchNovekinoRepertoire(cinema, fetcher), day, cinema);
    const needsHtmlEnrichment = (cinema === "atlantic" && day === warsawDate(now))
      || shows.some((show) => !show.poster);
    if (!needsHtmlEnrichment) return shows;
    try {
      return mergeShows(shows, await parseNovekinoHtml(cinema, day, fetcher));
    } catch (error) {
      console.error(`NoveKino ${cinema} HTML enrichment failed:`, error);
      return shows;
    }
  } catch (error) {
    console.error(`NoveKino ${cinema} ticketing API failed, using HTML fallback:`, error);
    return parseNovekinoHtml(cinema, day, fetcher);
  }
}
