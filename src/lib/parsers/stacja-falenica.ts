import * as cheerio from "cheerio";
import { normalizeWarsawDate, warsawDate } from "../warsaw-date.ts";
import { fetchWithTimeout } from "../../server/fetch.ts";

const FALENICA_ORIGIN = "https://ksf.systembiletowy.pl";

type FalenicaScreening = {
  time: string;
  link?: string;
  providerRef: { provider: "stacja-falenica"; screeningId: string };
};

export type FalenicaShow = {
  title: string;
  screenings: FalenicaScreening[];
  screeningLinksAreExplicit: true;
};

type ParseOptions = { fetcher?: typeof fetch };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim() : undefined;
}

function normalizedDay(value?: string | Date): string {
  if (typeof value === "string") return normalizeWarsawDate(value);
  return warsawDate(value instanceof Date ? value : undefined);
}

function eventUrl(value: unknown): { link: string; screeningId: string } | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw, FALENICA_ORIGIN);
    const screeningId = url.searchParams.get("id");
    if (url.protocol !== "https:" || url.hostname !== "ksf.systembiletowy.pl"
      || url.pathname !== "/repertoire/show" || !screeningId || !/^\d+$/.test(screeningId)
      || [...url.searchParams.keys()].some((key) => key !== "id")) {
      return undefined;
    }
    return { link: url.toString(), screeningId };
  } catch {
    return undefined;
  }
}

export async function parseStacjaFalenica(
  date?: string | Date,
  options: ParseOptions = {},
): Promise<FalenicaShow[]> {
  const day = normalizedDay(date);
  const fetcher = options.fetcher ?? fetchWithTimeout;
  const response = await fetcher(`${FALENICA_ORIGIN}/`, {
    headers: { Accept: "text/html" },
  });
  if (!response.ok) throw new Error(`Stacja Falenica returned ${response.status}`);

  const $ = cheerio.load(await response.text());
  const rawCalendar = $("[data-calendar-props]").first().attr("data-calendar-props");
  if (!rawCalendar) throw new Error("Stacja Falenica returned an invalid schedule page");

  let calendar: unknown;
  try {
    calendar = JSON.parse(rawCalendar);
  } catch {
    throw new Error("Stacja Falenica returned invalid calendar data");
  }
  if (!isRecord(calendar) || !isRecord(calendar.eventsByDate)) {
    throw new Error("Stacja Falenica returned invalid calendar data");
  }
  const events = calendar.eventsByDate[day];
  if (events === undefined) return [];
  if (!Array.isArray(events)) throw new Error("Stacja Falenica returned an invalid day schedule");

  const groups = new Map<string, FalenicaShow>();
  const seen = new Set<string>();
  for (const event of events) {
    if (!isRecord(event)) continue;
    const title = text(event.title);
    const time = text(event.time);
    const target = eventUrl(event.url);
    if (!title || !time || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)
      || !target || seen.has(target.screeningId)) continue;
    seen.add(target.screeningId);

    let show = groups.get(title);
    if (!show) {
      show = { title, screenings: [], screeningLinksAreExplicit: true };
      groups.set(title, show);
    }
    show.screenings.push({
      time,
      link: event.soldOut === true ? undefined : target.link,
      providerRef: { provider: "stacja-falenica", screeningId: target.screeningId },
    });
  }

  return [...groups.values()].map((show) => ({
    ...show,
    screenings: show.screenings.sort(
      (a, b) => a.time.localeCompare(b.time)
        || a.providerRef.screeningId.localeCompare(b.providerRef.screeningId),
    ),
  }));
}

export const siteName = "Kinokawiarnia Stacja Falenica";
