import { fetchWithTimeout } from "../../server/fetch.ts";
import { normalizeWarsawDate, warsawDate } from "../warsaw-date.ts";

const API_URL = "https://api.kicket.com/marketplace/events/listing";
const BILETOMAT_URL = "https://biletomat.pl";
const KINO_AMONDO_LOCATION_ID = "0195ccae-6dc3-7160-b0b2-ca864fb95dcc";
const PAGE_SIZE = 50;

type JsonObject = Record<string, unknown>;

type AmondoScreening = {
  time: string;
  link: string;
};

type AmondoShow = {
  title: string;
  poster?: string;
  screenings: AmondoScreening[];
};

const warsawTimeFormatter = new Intl.DateTimeFormat("en", {
  timeZone: "Europe/Warsaw",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function dateKey(value?: string | Date): string {
  return typeof value === "string"
    ? normalizeWarsawDate(value)
    : warsawDate(value);
}

function warsawTime(value: Date): string {
  const parts = Object.fromEntries(
    warsawTimeFormatter.formatToParts(value).map(({ type, value: part }) => [type, part]),
  );
  return `${parts.hour}:${parts.minute}`;
}

function ticketUrl(showSlug: string, showId: string, locationId: string, eventId: string): string {
  const url = new URL(`/wydarzenia/${encodeURIComponent(showSlug)}-${encodeURIComponent(showId)}`, BILETOMAT_URL);
  url.searchParams.set("locationId", locationId);
  url.searchParams.set("eventId", eventId);
  return url.toString();
}

function mapEvent(value: unknown, day: string) {
  const event = object(value);
  const displayPeriod = object(event?.displayPeriod);
  const show = object(event?.show);
  const location = object(event?.location);
  const eventId = text(event?.id);
  const title = text(event?.title);
  const startsAt = text(displayPeriod?.startsAt);
  const showId = text(show?.id);
  const showSlug = text(show?.slug);
  const locationId = text(location?.id);

  if (event?.cancelled === true || !eventId || !title || !startsAt || !showId || !showSlug || !locationId) {
    return null;
  }

  const startsAtDate = new Date(startsAt);
  if (!Number.isFinite(startsAtDate.getTime()) || warsawDate(startsAtDate) !== day) return null;

  const pictures = Array.isArray(show?.pictures) ? show.pictures : [];
  const pictureId = text(object(pictures[0])?.id);

  return {
    eventId,
    showId,
    title,
    time: warsawTime(startsAtDate),
    link: ticketUrl(showSlug, showId, locationId, eventId),
    poster: pictureId
      ? `${BILETOMAT_URL}/api/images/${encodeURIComponent(pictureId)}`
      : undefined,
  };
}

async function fetchPage(day: string, page: number): Promise<unknown[]> {
  const url = new URL(API_URL);
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", String(PAGE_SIZE));
  url.searchParams.set("location", KINO_AMONDO_LOCATION_ID);
  url.searchParams.set("dateRange.from", day);
  url.searchParams.set("dateRange.to", day);

  const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Kino Amondo returned ${response.status}`);

  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new Error("Kino Amondo returned an invalid response");
  return body;
}

export async function parseKinoamondo(date?: string | Date): Promise<AmondoShow[]> {
  const day = dateKey(date);
  const events: unknown[] = [];

  for (let page = 0; ; page += 1) {
    const records = await fetchPage(day, page);
    events.push(...records);
    if (records.length < PAGE_SIZE) break;
  }

  const shows = new Map<string, AmondoShow>();
  const eventIds = new Set<string>();

  for (const value of events) {
    const event = mapEvent(value, day);
    if (!event || eventIds.has(event.eventId)) continue;
    eventIds.add(event.eventId);

    const existing = shows.get(event.showId);
    const screening = { time: event.time, link: event.link };
    if (existing) {
      existing.screenings.push(screening);
      existing.poster ||= event.poster;
    } else {
      shows.set(event.showId, {
        title: event.title,
        ...(event.poster ? { poster: event.poster } : {}),
        screenings: [screening],
      });
    }
  }

  return [...shows.values()]
    .map((show) => ({
      ...show,
      screenings: show.screenings.sort((a, b) => a.time.localeCompare(b.time)),
    }))
    .sort((a, b) => a.screenings[0].time.localeCompare(b.screenings[0].time));
}

export const siteName = "Amondo";
