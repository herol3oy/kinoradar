import * as cheerio from "cheerio";
import { fetchWithTimeout } from "../../server/fetch.ts";
import { normalizeWarsawDate, warsawDate } from "../warsaw-date.ts";

const TICKETING_ORIGIN = "https://butik.mteatr.pl";
const REPERTOIRE_URL = "https://www.mteatr.pl/pl/repertuar-kino-praha";

const POLISH_MONTHS = new Map<string, number>([
  ["sty", 1],
  ["lut", 2],
  ["mar", 3],
  ["kwi", 4],
  ["maj", 5],
  ["cze", 6],
  ["lip", 7],
  ["sie", 8],
  ["wrz", 9],
  ["paz", 10],
  ["lis", 11],
  ["gru", 12],
]);

type PrahaFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type PrahaScreening = {
  time: string;
  link?: string;
};

type PrahaShow = {
  title: string;
  poster?: string;
  screenings: PrahaScreening[];
};

type ParseOptions = {
  fetcher?: PrahaFetcher;
};

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.replace(/\s+/g, " ").trim()
    : undefined;
}

function showKey(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pl")
    .replace(/\s+/g, " ")
    .trim();
}

function httpsUrl(value: unknown, base?: string, host?: string): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;

  try {
    const url = base ? new URL(raw, base) : new URL(raw);
    return url.protocol === "https:" && (!host || url.hostname === host)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function addShow(shows: Map<string, PrahaShow>, incoming: PrahaShow): void {
  const key = showKey(incoming.title);
  const existing = shows.get(key);
  if (!existing) {
    shows.set(key, incoming);
    return;
  }

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

function sortedShows(shows: Map<string, PrahaShow>): PrahaShow[] {
  return [...shows.values()]
    .map((show) => ({
      ...show,
      screenings: show.screenings.sort((a, b) => a.time.localeCompare(b.time)),
    }))
    .sort((a, b) => (
      (a.screenings[0]?.time ?? "").localeCompare(b.screenings[0]?.time ?? "")
      || a.title.localeCompare(b.title, "pl")
    ));
}

function ticketingUrl(day: string): URL {
  const url = new URL("/index/ajax.html", TICKETING_ORIGIN);
  url.searchParams.set("ajax", "pobierzTerminy");
  url.searchParams.set("selectedDate", day);
  url.searchParams.set("idl", "0");
  url.searchParams.set("idw", "");
  url.searchParams.set("idg", "1");
  return url;
}

async function parseTicketing(day: string, fetcher: PrahaFetcher): Promise<PrahaShow[]> {
  const response = await fetcher(ticketingUrl(day), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Kino Praha ticketing returned ${response.status}`);

  const payload = object(await response.json());
  if (payload?.status !== "complete" || !Array.isArray(payload.data)) {
    throw new Error("Kino Praha ticketing returned an invalid response");
  }

  const shows = new Map<string, PrahaShow>();
  for (const value of payload.data) {
    const event = object(value);
    const title = text(event?.wydarzenie);
    const time = text(event?.terminGodzina);
    const eventDate = text(event?.czas)?.slice(0, 10);
    if (!title || !time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || eventDate !== day) continue;

    const link = event?.przyciskDostepny === true
      ? httpsUrl(event.terminUrl, TICKETING_ORIGIN, "butik.mteatr.pl")
      : undefined;
    addShow(shows, {
      title,
      screenings: [{ time, ...(link ? { link } : {}) }],
    });
  }

  return sortedShows(shows);
}

function normalizedMonth(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pl")
    .slice(0, 3);
}

function labelDate(value: string): { day: string; time: string } | undefined {
  const match = /(\d{1,2})\s+([\p{Letter}.]+)\s+(\d{4})\s*\/\s*([0-2]\d:[0-5]\d)/u.exec(value);
  const month = match ? POLISH_MONTHS.get(normalizedMonth(match[2])) : undefined;
  if (!match || !month || !/^([01]\d|2[0-3]):[0-5]\d$/.test(match[4])) return undefined;

  const date = `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return { day: date, time: match[4] };
}

async function parseRepertoire(day: string, fetcher: PrahaFetcher): Promise<PrahaShow[]> {
  const response = await fetcher(REPERTOIRE_URL, {
    headers: { Accept: "text/html" },
  });
  if (!response.ok) throw new Error(`Kino Praha repertoire returned ${response.status}`);

  const $ = cheerio.load(await response.text());
  if ($("main#repertory-page").length === 0) {
    throw new Error("Kino Praha repertoire returned an invalid response");
  }

  const shows = new Map<string, PrahaShow>();
  $(".post.boxoffice-style").each((_, element) => {
    const post = $(element);
    const date = labelDate(post.find(".label").first().text());
    const title = text(post.find(".box_tytul h2").first().text());
    if (!date || date.day !== day || !title) return;

    const detailLink = httpsUrl(post.find("a").first().attr("href"), REPERTOIRE_URL, "www.mteatr.pl");
    const poster = httpsUrl(post.find(".image").first().attr("data-src"), REPERTOIRE_URL, "www.mteatr.pl");
    addShow(shows, {
      title,
      ...(poster ? { poster } : {}),
      screenings: [{ time: date.time, ...(detailLink ? { link: detailLink } : {}) }],
    });
  });

  return sortedShows(shows);
}

function mergeSources(ticketing: PrahaShow[], repertoire: PrahaShow[]): PrahaShow[] {
  const shows = new Map(ticketing.map((show) => [showKey(show.title), {
    ...show,
    screenings: [...show.screenings],
  }]));

  for (const htmlShow of repertoire) {
    const key = showKey(htmlShow.title);
    const current = shows.get(key);
    if (!current) {
      shows.set(key, htmlShow);
      continue;
    }

    current.poster ||= htmlShow.poster;
    for (const screening of htmlShow.screenings) {
      const duplicate = current.screenings.find((item) => item.time === screening.time);
      if (!duplicate) current.screenings.push(screening);
    }
  }

  return sortedShows(shows);
}

export async function parseKinopraha(
  date?: string | Date,
  options: ParseOptions = {},
): Promise<PrahaShow[]> {
  const day = typeof date === "string" ? normalizeWarsawDate(date) : warsawDate(date);
  const fetcher = options.fetcher ?? fetchWithTimeout;
  const [ticketing, repertoire] = await Promise.allSettled([
    parseTicketing(day, fetcher),
    parseRepertoire(day, fetcher),
  ]);

  if (ticketing.status === "fulfilled" && repertoire.status === "fulfilled") {
    return mergeSources(ticketing.value, repertoire.value);
  }
  if (ticketing.status === "fulfilled") {
    console.error("Kino Praha HTML enrichment failed:", repertoire.reason);
    return ticketing.value;
  }
  if (repertoire.status === "fulfilled") {
    console.error("Kino Praha ticketing API failed, using HTML fallback:", ticketing.reason);
    return repertoire.value;
  }

  throw new AggregateError(
    [ticketing.reason, repertoire.reason],
    "Kino Praha sources failed",
  );
}

export const siteName = "Praha";
