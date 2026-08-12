import * as cheerio from "cheerio";
import {
  KINO_KULTURA_TICKETING_BASE,
  isKinokulturaScreeningId,
  kinokulturaBookingUrl,
  kinokulturaPosterUrl,
  kinokulturaRepertoireUrl,
} from "../kinokultura.ts";
import { parseScreeningTitle, type ScreeningLanguage } from "../screening-language.ts";
import { warsawDate } from "../warsaw-date.ts";
import { fetchWithTimeout } from "../../server/fetch.ts";
import {
  fetchKinokulturaRepertoire,
  type KinokulturaFetcher,
  type KinokulturaRepertoireEvent,
} from "../../server/kinokultura.ts";

type KinokulturaScreening = ScreeningLanguage & {
  time: string;
  link?: string;
  providerRef?: {
    provider: "kinokultura";
    screeningId: string;
  };
  presentation?: { printType?: string };
};

type KinokulturaShow = {
  title: string;
  filmId?: string;
  poster?: string;
  screenings: KinokulturaScreening[];
};

type ParseOptions = {
  fetcher?: KinokulturaFetcher;
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
  return isKinokulturaScreeningId(id) ? id : undefined;
}

function eventTime(value: unknown): string | undefined {
  const match = typeof value === "string" ? /T([01]\d|2[0-3]):([0-5]\d)/.exec(value) : null;
  return match ? `${match[1]}:${match[2]}` : undefined;
}

function transactionMode(value: unknown): 0 | 1 | undefined {
  return value === 0 || value === 1 ? value : undefined;
}

function eventLanguage(event: KinokulturaRepertoireEvent, title: string): ScreeningLanguage {
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

function eventPresentation(event: KinokulturaRepertoireEvent) {
  const printType = event.details?.is_3D === true ? "3D" : event.details?.is_2D === true ? "2D" : undefined;
  return printType ? { presentation: { printType } } : {};
}

function absoluteUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, `${KINO_KULTURA_TICKETING_BASE}/`);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function screeningIdFromLink(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const id = new URL(value).searchParams.get("event_id") ?? "";
    return isKinokulturaScreeningId(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

function showKey(show: Pick<KinokulturaShow, "filmId" | "title">): string {
  return show.filmId
    ? `film:${show.filmId}`
    : `title:${parseScreeningTitle(show.title).canonicalTitle.toLocaleLowerCase("pl")}`;
}

function screeningKey(screening: KinokulturaScreening): string {
  return screening.providerRef ? `event:${screening.providerRef.screeningId}` : `time:${screening.time}`;
}

function mergeScreenings(
  current: KinokulturaScreening[],
  incoming: KinokulturaScreening[],
): KinokulturaScreening[] {
  const merged = new Map(current.map((screening) => [screeningKey(screening), screening]));
  for (const screening of incoming) {
    const key = screeningKey(screening);
    const existing = merged.get(key);
    if (existing) {
      const value = { ...screening, ...existing };
      if (!existing.link) delete value.link;
      merged.set(key, value);
      continue;
    }
    if (!screening.providerRef && [...merged.values()].some((item) => item.time === screening.time)) continue;
    merged.set(key, screening);
  }
  return [...merged.values()].sort((a, b) => a.time.localeCompare(b.time) || screeningKey(a).localeCompare(screeningKey(b)));
}

function parseTicketingEvents(events: KinokulturaRepertoireEvent[], day: string): KinokulturaShow[] {
  const groups = new Map<string, KinokulturaShow>();

  for (const event of events) {
    if (typeof event.eventDateTime !== "string" || !event.eventDateTime.startsWith(`${day}T`)) continue;
    const id = eventId(event.eventId);
    const time = eventTime(event.eventDateTime);
    const title = text(event.eventTitle) ?? text(event.details?.shortName) ?? text(event.details?.name);
    if (!id || !time || !title) continue;

    const filmId = positiveNumericId(event.eventDetailId) ?? positiveNumericId(event.details?.id);
    const imageId = positiveNumericId(event.imageId) ?? positiveNumericId(event.details?.imageId);
    const show: KinokulturaShow = {
      title,
      filmId,
      ...(imageId ? { poster: kinokulturaPosterUrl(imageId) } : {}),
      screenings: [],
    };
    const key = showKey(show);
    const group = groups.get(key) ?? show;
    group.poster ||= show.poster;
    const mode = transactionMode(event.linkUrlParam?.typetran);
    group.screenings = mergeScreenings(group.screenings, [{
      time,
      ...(event.linkActive === true && mode !== undefined
        ? { link: kinokulturaBookingUrl(id, mode, day) }
        : {}),
      providerRef: { provider: "kinokultura", screeningId: id },
      ...eventLanguage(event, title),
      ...eventPresentation(event),
    }]);
    groups.set(key, group);
  }

  return [...groups.values()];
}

async function parseKinokulturaHtml(day: string, fetcher: KinokulturaFetcher): Promise<KinokulturaShow[]> {
  const response = await fetcher(kinokulturaRepertoireUrl(day));
  if (!response.ok) throw new Error(`Kino Kultura returned ${response.status}`);
  const $ = cheerio.load(await response.text());
  const shows: KinokulturaShow[] = [];

  $("div.movies-movie").each((_, movie) => {
    const title = $(movie).find("h2.movies-movie__single__title").first().text().trim();
    if (!title) return;
    const posterElement = $(movie).find(".movies-movie__single__poster img").first();
    const poster = absoluteUrl(posterElement.attr("src"));
    const detailMatch = /showEventDetails\(['\"]?(\d+)['\"]?\)/.exec(posterElement.attr("onclick") ?? "");
    const filmId = detailMatch ? positiveNumericId(detailMatch[1]) : undefined;
    const screenings: KinokulturaScreening[] = [];

    $(movie).find(".d-none.d-md-block.d-lg-flex .js-event-hours li").each((_, item) => {
      const anchor = $(item).find("a").first();
      const time = (anchor.text() || $(item).text()).trim();
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
      const ticketLink = absoluteUrl(anchor.attr("href"));
      const id = eventId(anchor.attr("data-event") ?? $(item).attr("event-filter"))
        ?? screeningIdFromLink(ticketLink);
      screenings.push({
        time,
        ...(ticketLink ? { link: ticketLink } : {}),
        ...(id ? { providerRef: { provider: "kinokultura", screeningId: id } } : {}),
      });
    });

    shows.push({ title, filmId, poster, screenings });
  });

  return shows;
}

function mergeShows(primary: KinokulturaShow[], enrichment: KinokulturaShow[]): KinokulturaShow[] {
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
      poster: incoming.poster ?? current.poster,
      screenings: mergeScreenings(current.screenings, incoming.screenings),
    });
  }
  return [...merged.values()];
}

export async function parseKinokultura(
  date?: string | Date,
  options: ParseOptions = {},
): Promise<KinokulturaShow[]> {
  const now = options.now ?? new Date();
  const day = dayKey(date, now);
  const fetcher = options.fetcher ?? fetchWithTimeout;

  try {
    const shows = parseTicketingEvents(await fetchKinokulturaRepertoire(fetcher), day);
    const needsHtmlEnrichment = day === warsawDate(now) || shows.some((show) => !show.poster);
    if (!needsHtmlEnrichment) return shows;
    try {
      return mergeShows(shows, await parseKinokulturaHtml(day, fetcher));
    } catch (error) {
      console.error("Kino Kultura HTML enrichment failed:", error);
      return shows;
    }
  } catch (error) {
    console.error("Kino Kultura ticketing API failed, using HTML fallback:", error);
    return parseKinokulturaHtml(day, fetcher);
  }
}

export const siteName = "Kultura";
