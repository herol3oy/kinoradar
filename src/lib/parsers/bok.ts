import * as cheerio from "cheerio";
import { BOK_ORIGIN, getBokCinema, type BokCinema } from "../bok.ts";
import { normalizeWarsawDate, WARSAW_TIME_ZONE, warsawDate } from "../warsaw-date.ts";
import { fetchWithTimeout } from "../../server/fetch.ts";

type BokScreening = { time: string; link: string };

export type BokShow = {
  title: string;
  link: string;
  poster?: string;
  screenings: BokScreening[];
  screeningLinksAreExplicit: true;
};

type ParseOptions = { fetcher?: typeof fetch };

const offsetFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: WARSAW_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const polishDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  timeZone: WARSAW_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

function partsByType(formatter: Intl.DateTimeFormat, date: Date): Record<string, string> {
  return Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
}

function warsawOffsetMs(date: Date): number {
  const parts = partsByType(offsetFormatter, date);
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  ) - Math.trunc(date.getTime() / 1000) * 1000;
}

export function warsawMidnightEpochSeconds(day: string): number {
  const normalized = normalizeWarsawDate(day, new Date(0));
  if (normalized !== day) throw new RangeError(`Invalid date key: ${day}`);
  const [year, month, date] = day.split("-").map(Number);
  const localClock = Date.UTC(year, month - 1, date);
  let instant = localClock;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    instant = localClock - warsawOffsetMs(new Date(instant));
  }
  return Math.trunc(instant / 1000);
}

function normalizedDay(value?: string | Date): string {
  if (typeof value === "string") return normalizeWarsawDate(value);
  return warsawDate(value instanceof Date ? value : undefined);
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function validBokUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value, BOK_ORIGIN);
    return url.protocol === "https:" && url.hostname === "bok.waw.pl" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function expectedHeading(day: string): string {
  const epoch = warsawMidnightEpochSeconds(day);
  return polishDateFormatter.format(new Date(epoch * 1000)).toLocaleLowerCase("pl-PL");
}

export async function parseBokCinema(
  cinema: BokCinema,
  date?: string | Date,
  options: ParseOptions = {},
): Promise<BokShow[]> {
  const config = getBokCinema(cinema);
  const day = normalizedDay(date);
  const url = `${BOK_ORIGIN}${config.path},ts:${warsawMidnightEpochSeconds(day)}`;
  const fetcher = options.fetcher ?? fetchWithTimeout;
  const response = await fetcher(url, { headers: { Accept: "text/html" } });
  if (!response.ok) throw new Error(`${config.name} returned ${response.status}`);

  const $ = cheerio.load(await response.text());
  const calendar = $(".calendar-children").first();
  if (!calendar.length) throw new Error(`${config.name} returned an invalid schedule page`);
  const heading = cleanText(calendar.find("strong").first().text()).toLocaleLowerCase("pl-PL");
  if (heading !== expectedHeading(day)) {
    throw new Error(`${config.name} returned the wrong schedule date`);
  }

  const shows: BokShow[] = [];
  calendar.find(".basic-list-item").each((_, item) => {
    const anchor = $(item).find("a.movie-list").first();
    const link = validBokUrl(anchor.attr("href"));
    const rawTitle = cleanText($(item).find(".movie-list-descr .fs-30").first().text());
    const title = rawTitle.replace(/\s*\|\s*PREMIERA\s*$/iu, "").trim();
    if (!title || !link || !new URL(link).pathname.startsWith(`${config.path}/`)) return;

    const seen = new Set<string>();
    const screenings = $(item).find(".movieshow-list-movie-descr")
      .map((_, element) => cleanText($(element).text()))
      .get()
      .filter((time) => {
        if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) || seen.has(time)) return false;
        seen.add(time);
        return true;
      })
      .map((time) => ({ time, link }));
    if (screenings.length === 0) return;

    const poster = validBokUrl($(item).find("img").first().attr("src"));
    shows.push({
      title,
      link,
      poster,
      screenings,
      screeningLinksAreExplicit: true,
    });
  });

  return shows;
}
