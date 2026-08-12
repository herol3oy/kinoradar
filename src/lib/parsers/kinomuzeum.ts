import { fetchWithTimeout } from "../../server/fetch.ts";
import { normalizeWarsawDate, warsawDate } from "../warsaw-date.ts";

const API_ORIGIN = "https://api-sf.artmuseum.pl";
const CALENDAR_PATH = "/api/open/event_terms/calendar";

type JsonObject = Record<string, unknown>;

type KinomuzeumScreening = {
  time: string;
  link?: string;
};

type KinomuzeumShow = {
  title: string;
  poster?: string;
  screenings: KinomuzeumScreening[];
};

function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function titleText(value: unknown): string | undefined {
  const valueText = text(value);
  return valueText?.replace(/\s+/g, " ");
}

function dateKey(value?: string | Date): string {
  return typeof value === "string"
    ? normalizeWarsawDate(value)
    : warsawDate(value);
}

function httpsUrl(value: unknown, base?: string): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;

  try {
    const url = base ? new URL(raw, base) : new URL(raw);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function mapTerm(value: unknown) {
  const term = object(value);
  const parent = object(term?.parent);
  const translations = object(parent?.translations);
  const polish = object(translations?.pl);
  const thumbs = object(parent?.thumbs);
  const listThumb = object(thumbs?.list);
  const occurrenceId = text(term?.uuid);
  const parentId = text(parent?.uuid) ?? text(term?.parentUuid);
  const title = titleText(polish?.title);
  const time = text(term?.timeFrom);

  if (!occurrenceId || !parentId || !title || !time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return null;
  }

  return {
    occurrenceId,
    parentId,
    title,
    time,
    link: httpsUrl(term?.ticketUrl),
    poster: httpsUrl(listThumb?.url, API_ORIGIN),
  };
}

export async function parseKinomuzeum(date?: string | Date): Promise<KinomuzeumShow[]> {
  const day = dateKey(date);
  const url = new URL(`${CALENDAR_PATH}/${encodeURIComponent(day)}/type/cinema`, API_ORIGIN);
  const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });

  if (!response.ok) throw new Error(`KINOMUZEUM returned ${response.status}`);

  const body: unknown = await response.json();
  const calendar = object(body);
  if (!calendar) throw new Error("KINOMUZEUM returned an invalid response");

  const dayValue = calendar[day];
  if (dayValue === undefined) return [];
  if (!Array.isArray(dayValue)) throw new Error("KINOMUZEUM returned an invalid response");

  const shows = new Map<string, KinomuzeumShow>();
  const occurrenceIds = new Set<string>();

  for (const value of dayValue) {
    const term = mapTerm(value);
    if (!term || occurrenceIds.has(term.occurrenceId)) continue;
    occurrenceIds.add(term.occurrenceId);

    const screening = {
      time: term.time,
      ...(term.link ? { link: term.link } : {}),
    };
    const existing = shows.get(term.parentId);

    if (existing) {
      existing.screenings.push(screening);
      existing.poster ||= term.poster;
    } else {
      shows.set(term.parentId, {
        title: term.title,
        ...(term.poster ? { poster: term.poster } : {}),
        screenings: [screening],
      });
    }
  }

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

export const siteName = "KINOMUZEUM";
