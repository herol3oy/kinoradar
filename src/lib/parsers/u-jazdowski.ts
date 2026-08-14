import * as cheerio from "cheerio";
import { fetchWithTimeout } from "../../server/fetch.ts";
import { isDateKey, warsawDate, warsawMidnightEpochSeconds } from "../warsaw-date.ts";

const ORIGIN = "https://u-jazdowski.pl";
const REPERTOIRE_PATH = "/kino/repertuar/week.ajax";

type UJazdowskiFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type UJazdowskiScreening = {
  time: string;
  link?: string;
};

type UJazdowskiShow = {
  title: string;
  link?: string;
  poster?: string;
  screenings: UJazdowskiScreening[];
};

type ParseOptions = {
  fetcher?: UJazdowskiFetcher;
};

function requestedDay(value?: string | Date): string {
  if (typeof value !== "string") return warsawDate(value);
  if (!isDateKey(value)) throw new RangeError(`Invalid U-Jazdowski date: ${value}`);
  return value;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function showKey(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pl")
    .replace(/\s+/g, " ")
    .trim();
}

function uJazdowskiUrl(value: string | undefined, pathPrefix: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, ORIGIN);
    return url.protocol === "https:"
      && url.hostname === "u-jazdowski.pl"
      && url.pathname.startsWith(pathPrefix)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function screeningTimes(value: string): string[] {
  const matches = value.matchAll(/(?:^|\D)([01]?\d|2[0-3])\s*[:\u00b7]\s*([0-5]\d)(?=\D|$)/g);
  return [...new Set([...matches].map((match) => `${match[1].padStart(2, "0")}:${match[2]}`))];
}

function assertRequestedDay($: cheerio.CheerioAPI, day: string): void {
  const activeHref = $("#calendar-nav a.cal-nav-day.active").first().attr("href");
  const activeUrl = uJazdowskiUrl(activeHref, "/kino/repertuar");
  const timestamp = activeUrl ? Number(new URL(activeUrl).searchParams.get("ut")) : Number.NaN;
  if (!Number.isSafeInteger(timestamp) || warsawDate(new Date(timestamp * 1000)) !== day) {
    throw new Error("U-Jazdowski returned the wrong schedule date");
  }
}

function addShow(shows: Map<string, UJazdowskiShow>, incoming: UJazdowskiShow): void {
  const key = showKey(incoming.title);
  const existing = shows.get(key);
  if (!existing) {
    shows.set(key, incoming);
    return;
  }

  existing.link ||= incoming.link;
  existing.poster ||= incoming.poster;
  for (const screening of incoming.screenings) {
    const duplicate = existing.screenings.find((item) => item.time === screening.time);
    if (!duplicate) {
      existing.screenings.push(screening);
    } else if (!duplicate.link && screening.link) {
      duplicate.link = screening.link;
    }
  }
}

export async function parseUJazdowski(
  date?: string | Date,
  options: ParseOptions = {},
): Promise<UJazdowskiShow[]> {
  const day = requestedDay(date);
  const url = new URL(REPERTOIRE_PATH, ORIGIN);
  url.searchParams.set("ut", String(warsawMidnightEpochSeconds(day)));

  const fetcher = options.fetcher ?? fetchWithTimeout;
  const response = await fetcher(url, { headers: { Accept: "text/html" } });
  if (!response.ok) throw new Error(`U-Jazdowski returned ${response.status}`);

  const $ = cheerio.load(await response.text());
  if ($("#calendar-nav").length === 0 || $("#calendar-items").length === 0) {
    throw new Error("U-Jazdowski returned an invalid schedule page");
  }
  assertRequestedDay($, day);

  const shows = new Map<string, UJazdowskiShow>();
  $("#calendar-items a.event-list-day-box").each((_, element) => {
    const card = $(element);
    const title = cleanText(card.find("div.title em").first().text());
    const times = screeningTimes(card.find("div.hours").text());
    if (!title || times.length === 0) return;

    const link = uJazdowskiUrl(card.attr("href"), "/kino/repertuar/");
    const poster = uJazdowskiUrl(card.find("picture img").first().attr("src"), "/upload/");
    addShow(shows, {
      title,
      ...(link ? { link } : {}),
      ...(poster ? { poster } : {}),
      screenings: times.map((time) => ({ time, ...(link ? { link } : {}) })),
    });
  });

  return [...shows.values()]
    .map((show) => ({
      ...show,
      screenings: show.screenings.sort((a, b) => a.time.localeCompare(b.time)),
    }))
    .sort((a, b) => (
      a.screenings[0].time.localeCompare(b.screenings[0].time)
      || a.title.localeCompare(b.title, "pl")
    ));
}

export const siteName = "U-Jazdowski";
